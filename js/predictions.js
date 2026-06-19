// Prédictions de score — Modèle de Poisson v2
//
// λA = attackStrength(A) × defWeakness(B) × avgGF
//    avec régression vers la moyenne (prior K=3 matchs fantômes) pour
//    éviter que 1 seul match ne domine la prédiction.
//
// Après 1 match joué : ~25% stats propres / 75% moyenne tournoi
// Après 3 matchs     : ~50% stats propres / 50% moyenne tournoi
//
// buildPredictions() est appelé depuis api.js après chaque mise à jour des
// standings. renderMatchRow() lit la map `predictions` globale.

var predictions = {};

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

  var totalGF = 0, totalGA = 0, totalPlayed = 0;
  Object.keys(standings).forEach(function(g) {
    standings[g].forEach(function(r) {
      totalGF     += r.gf     || 0;
      totalGA     += r.ga     || 0;
      totalPlayed += r.played || 0;
    });
  });
  var avgGF = totalPlayed > 0 ? totalGF / totalPlayed : 1.3;
  var avgGA = totalPlayed > 0 ? totalGA / totalPlayed : 1.3;

  var hasStats = !!(s1 && s1.played > 0 && s2 && s2.played > 0);

  // Régression vers la moyenne : K = nb de matchs "fantômes" au niveau moyen
  // Plus K est grand, plus on reste proche de la moyenne avec peu de matchs joués.
  var K = 3;
  var p1 = s1 && s1.played > 0 ? s1.played : 0;
  var p2 = s2 && s2.played > 0 ? s2.played : 0;
  var w1 = p1 / (p1 + K);
  var w2 = p2 / (p2 + K);

  var rawGF1 = p1 > 0 ? s1.gf / p1 : avgGF;
  var rawGA1 = p1 > 0 ? (s1.ga || 0) / p1 : avgGA;
  var rawGF2 = p2 > 0 ? s2.gf / p2 : avgGF;
  var rawGA2 = p2 > 0 ? (s2.ga || 0) / p2 : avgGA;

  var gf1 = w1 * rawGF1 + (1 - w1) * avgGF;
  var ga1 = w1 * rawGA1 + (1 - w1) * avgGA;
  var gf2 = w2 * rawGF2 + (1 - w2) * avgGF;
  var ga2 = w2 * rawGA2 + (1 - w2) * avgGA;

  var lambdaA = Math.max(0.2, Math.min(4.0, gf1 * ga2 / avgGF));
  var lambdaB = Math.max(0.2, Math.min(4.0, gf2 * ga1 / avgGF));

  var MAX_G = 7;
  var bestP = -1, bestI = 1, bestJ = 0;
  var probW = 0, probD = 0, probL = 0;

  for (var i = 0; i <= MAX_G; i++) {
    var pA = _poissonPMF(lambdaA, i);
    for (var j = 0; j <= MAX_G; j++) {
      var p = pA * _poissonPMF(lambdaB, j);
      if (p > bestP) { bestP = p; bestI = i; bestJ = j; }
      if (i > j) probW += p;
      else if (i === j) probD += p;
      else probL += p;
    }
  }

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
