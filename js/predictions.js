// Prédictions de score — Modèle de Poisson v4
//
// Prior basé sur les rating FIFA officiels du 11 juin 2026 (veille du tournoi).
// Source : FIFA Men's World Ranking June 11, 2026
//   https://inside.fifa.com/fifa-world-ranking/men
//
// Régression bayésienne K=6 : il faut ~6 matchs pour que les stats propres
// pèsent autant que le prior FIFA. Cela évite qu'un seul J1 difficile
// (ex: Maroc vs Brésil 0-2) écrase le prior d'une équipe qui vaut top-10.
//
// Formula :
//   priorGF_A = avgGF × (fifaA / avgFifa)^1.5
//   priorGA_B = avgGA × (avgFifa / fifaB)^1.5
//   w = played / (played + K)
//   gf_A = w × rawGF_A + (1-w) × priorGF_A
//   lambdaA = gf_A × ga_B / avgGF

var predictions = {};

// Rating FIFA officiels juin 2026 pour les 48 équipes du WC 2026 (points)
// Source : FIFA World Ranking 11 juin 2026 + football-ranking.com
var FIFA_RATINGS = {
  // Top 10
  'Argentine':      1877, 'Espagne':        1870, 'France':         1855,
  'Angleterre':     1840, 'Portugal':       1778, 'Brésil':         1765,
  'Maroc':          1750, 'Pays-Bas':       1745, 'Allemagne':      1738,
  'Belgique':       1730,
  // 11-20
  'Colombie':       1712, 'Mexique':        1705, 'Croatie':        1668,
  'USA':            1676, 'Sénégal':        1648, 'Japon':          1655,
  'Uruguay':        1625, 'Suisse':         1641, 'Norvège':        1618,
  'Autriche':       1608,
  // 21-32
  'Corée du Sud':   1582, 'Turquie':        1595, 'Suède':          1575,
  'Canada':         1572, 'Équateur':       1562, "Côte d'Ivoire":  1555,
  'Algérie':        1542, 'Australie':      1558, 'Iran':           1552,
  'Égypte':         1528, 'Tunisie':        1455, 'Écosse':         1490,
  // 33-48
  'Paraguay':       1485, 'Congo RD':       1482, 'Ouzbékistan':    1470,
  'Tchéquie':       1468, 'Cap-Vert':       1468, 'Ghana':          1462,
  'Panama':         1462, 'Arabie S.':      1452, 'Jordanie':       1445,
  'Afrique du Sud': 1438, 'Irak':           1435, 'Qatar':          1448,
  'Bosnie-H.':      1387, 'Haïti':          1398, 'Nv-Zélande':     1365,
  'Curaçao':        1342,
};

// Moyenne FIFA des 48 équipes (calculée une fois au chargement)
var _avgFifa = (function() {
  var keys = Object.keys(FIFA_RATINGS);
  var sum = 0;
  keys.forEach(function(k) { sum += FIFA_RATINGS[k]; });
  return sum / keys.length;
})();

function _poissonPMF(lambda, k) {
  var p = Math.exp(-lambda);
  for (var i = 1; i <= k; i++) p = p * lambda / i;
  return p;
}

function computeMatchPrediction(t1, t2) {
  var s1 = null, s2 = null;
  Object.keys(standings).forEach(function(g) {
    standings[g].forEach(function(r) {
      if (r.team === t1) s1 = r;
      if (r.team === t2) s2 = r;
    });
  });

  // Moyenne tournoi (buts par équipe par match)
  var totalGF = 0, totalGA = 0, totalPlayed = 0;
  Object.keys(standings).forEach(function(g) {
    standings[g].forEach(function(r) {
      totalGF     += r.gf     || 0;
      totalGA     += r.ga     || 0;
      totalPlayed += r.played || 0;
    });
  });
  var avgGF = totalPlayed > 0 ? totalGF / totalPlayed : 1.3;
  var avgGA = avgGF;

  var hasStats = !!(s1 && s1.played > 0 && s2 && s2.played > 0);

  // ── Prior FIFA ────────────────────────────────────────────────────────────
  var DEFAULT_RATING = 1450;
  var fifaA = FIFA_RATINGS[t1] || DEFAULT_RATING;
  var fifaB = FIFA_RATINGS[t2] || DEFAULT_RATING;
  // POWER=1.5 : différencie suffisamment sans exagérer
  // Ex: Maroc (1750) vs Écosse (1490) → Maroc ~58% favori (prior pur)
  var POWER = 1.5;
  var priorGF1 = avgGF * Math.pow(fifaA / _avgFifa, POWER);
  var priorGA1 = avgGA * Math.pow(_avgFifa / fifaA, POWER);
  var priorGF2 = avgGF * Math.pow(fifaB / _avgFifa, POWER);
  var priorGA2 = avgGA * Math.pow(_avgFifa / fifaB, POWER);

  // ── Régression vers le prior FIFA ─────────────────────────────────────────
  var p1 = s1 && s1.played > 0 ? s1.played : 0;
  var p2 = s2 && s2.played > 0 ? s2.played : 0;
  // K=6 : après 1 match, seulement 14% de poids sur les stats réelles
  // Évite qu'une défaite difficile (ex: 0-2 vs Brésil) écrase le prior
  var K = 6;
  var w1 = p1 / (p1 + K);
  var w2 = p2 / (p2 + K);

  var rawGF1 = p1 > 0 ? s1.gf / p1 : priorGF1;
  var rawGA1 = p1 > 0 ? (s1.ga || 0) / p1 : priorGA1;
  var rawGF2 = p2 > 0 ? s2.gf / p2 : priorGF2;
  var rawGA2 = p2 > 0 ? (s2.ga || 0) / p2 : priorGA2;

  var gf1 = w1 * rawGF1 + (1 - w1) * priorGF1;
  var ga1 = w1 * rawGA1 + (1 - w1) * priorGA1;
  var gf2 = w2 * rawGF2 + (1 - w2) * priorGF2;
  var ga2 = w2 * rawGA2 + (1 - w2) * priorGA2;

  var lambdaA = Math.max(0.2, Math.min(4.0, gf1 * ga2 / avgGF));
  var lambdaB = Math.max(0.2, Math.min(4.0, gf2 * ga1 / avgGF));

  var MAX_G = 7;
  // Score le plus probable dans chaque catégorie (W / D / L)
  var bestWP=-1, bestWI=1, bestWJ=0;
  var bestDP=-1, bestDI=1, bestDJ=1;
  var bestLP=-1, bestLI=0, bestLJ=1;
  var probW = 0, probD = 0, probL = 0;

  for (var i = 0; i <= MAX_G; i++) {
    var pA = _poissonPMF(lambdaA, i);
    for (var j = 0; j <= MAX_G; j++) {
      var p = pA * _poissonPMF(lambdaB, j);
      if (i > j) { probW += p; if (p > bestWP) { bestWP=p; bestWI=i; bestWJ=j; } }
      else if (i === j) { probD += p; if (p > bestDP) { bestDP=p; bestDI=i; bestDJ=j; } }
      else { probL += p; if (p > bestLP) { bestLP=p; bestLI=i; bestLJ=j; } }
    }
  }

  // Afficher le score le plus probable pour l'issue la plus probable (V/N/D)
  var bestI, bestJ;
  if (probW >= probD && probW >= probL)      { bestI=bestWI; bestJ=bestWJ; }
  else if (probD >= probW && probD >= probL) { bestI=bestDI; bestJ=bestDJ; }
  else                                        { bestI=bestLI; bestJ=bestLJ; }

  var tot = probW + probD + probL;
  return {
    score:    bestI + '-' + bestJ,
    probW:    Math.round(probW / tot * 100),
    probD:    Math.round(probD / tot * 100),
    probL:    Math.round(probL / tot * 100),
    lambdaA:  Math.round(lambdaA * 10) / 10,
    lambdaB:  Math.round(lambdaB * 10) / 10,
    hasStats: hasStats,
  };
}

// Regex pour exclure les placeholders KO ("1er Gr.A", "V M73", "3e A/B/C/D"...)
var _PRED_SKIP = /^(1er |2e |3e |Vainq\.|V [A-Z]|Perdant )/;

function buildPredictions() {
  predictions = {};
  if (!allMatches || !Object.keys(standings).length) return;
  allMatches.forEach(function(m) {
    if (m.isFT || m.isLive) return;
    if (!m.t1 || !m.t2) return;
    if (_PRED_SKIP.test(m.t1) || _PRED_SKIP.test(m.t2)) return;
    predictions[m.id] = computeMatchPrediction(m.t1, m.t2);
  });
}
