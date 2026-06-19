// Prédictions de score — Modèle de Poisson v1
//
// Utilise les statistiques de phase de groupes (standings) déjà en mémoire :
//   λA = (gf_A/played_A) × (ga_B/played_B) / avgGoals
//   λB = (gf_B/played_B) × (ga_A/played_A) / avgGoals
//
// Score prédit  = argmax P(A=i, B=j)
// V/N/D %       = Σ P(i>j) / P(i=j) / P(i<j) normalisés sur 0..7
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

  // Moyenne du tournoi : buts marqués par équipe par match
  var totalGF = 0, totalGA = 0, totalPlayed = 0;
  Object.keys(standings).forEach(function(g) {
    standings[g].forEach(function(r) {
      totalGF    += r.gf   || 0;
      totalGA    += r.ga   || 0;
      totalPlayed += r.played || 0;
    });
  });
  var avgGF = totalPlayed > 0 ? totalGF / totalPlayed : 1.3;
  var avgGA = totalPlayed > 0 ? totalGA / totalPlayed : 1.3;

  var hasStats = !!(s1 && s1.played > 0 && s2 && s2.played > 0);

  var gf1 = (s1 && s1.played > 0) ? s1.gf / s1.played : avgGF;
  var ga1 = (s1 && s1.played > 0) ? (s1.ga || 0) / s1.played : avgGA;
  var gf2 = (s2 && s2.played > 0) ? s2.gf / s2.played : avgGF;
  var ga2 = (s2 && s2.played > 0) ? (s2.ga || 0) / s2.played : avgGA;

  // Paramètres Poisson (clampés à [0.3, 3.5])
  var lambdaA = Math.max(0.3, Math.min(3.5, gf1 * ga2 / avgGF));
  var lambdaB = Math.max(0.3, Math.min(3.5, gf2 * ga1 / avgGF));

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
    score:   bestI + '-' + bestJ,
    probW:   Math.round(probW / tot * 100),
    probD:   Math.round(probD / tot * 100),
    probL:   Math.round(probL / tot * 100),
    lambdaA: Math.round(lambdaA * 10) / 10,
    lambdaB: Math.round(lambdaB * 10) / 10,
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
