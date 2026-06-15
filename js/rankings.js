// ─── RANKINGS : Joueurs & Gardiens ───────────────────────────────────────────
// Consomme les endpoints /stats/players et /stats/keepers du Cloudflare Worker
// Les données sont pré-calculées côté serveur et mises en cache dans KV

var WORKER_BASE = 'https://wc2026.mguenoun.workers.dev';

// ─── GARDIENS ────────────────────────────────────────────────────────────────

var keepersLoaded = false;

async function fetchKeepers() {
  var c = document.getElementById('keepers-list');
  if (!c) return;
  c.innerHTML = '<p style="color:#475569;font-size:11px;padding:16px">⏳ Chargement…</p>';

  try {
    var data = await fetch(WORKER_BASE + '/stats/keepers').then(function(r) { return r.json(); });
    var ranking = data.ranking || [];

    if (!ranking.length) {
      c.innerHTML = '<p style="color:#475569;font-size:11px;padding:16px">Données disponibles dès le premier match joué.</p>';
      return;
    }

    var html = '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">' +
      '<span style="min-width:20px">#</span>' +
      '<span style="flex:1">Gardien</span>' +
      '<span style="min-width:28px;text-align:center">MJ</span>' +
      '<span style="min-width:32px;text-align:center;color:#22c55e">SV</span>' +
      '<span style="min-width:32px;text-align:center;color:#ef4444">Enc.</span>' +
      '<span style="min-width:32px;text-align:center;color:#0ea5e9">CS</span>' +
      '</div>';

    ranking.forEach(function(k, i) {
      var rankColor = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569';
      html += '<div class="scorer-row">' +
        '<span class="scorer-rank" style="color:' + rankColor + '">' + (i + 1) + '</span>' +
        '<span class="scorer-name">' + k.name +
          '<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">(' + k.team + ')</span>' +
        '</span>' +
        '<span style="font-size:10px;color:#64748b;min-width:28px;text-align:center">' + k.matches + '</span>' +
        '<span style="font-size:12px;font-weight:800;color:#22c55e;min-width:32px;text-align:center">' + k.saves + '</span>' +
        '<span style="font-size:12px;font-weight:800;color:#ef4444;min-width:32px;text-align:center">' + k.ga + '</span>' +
        '<span style="font-size:12px;font-weight:800;color:#0ea5e9;min-width:32px;text-align:center">' + k.cleanSheets + '</span>' +
        '</div>';
    });

    html += '</div>';
    c.innerHTML = html;
    keepersLoaded = true;

  } catch (e) {
    c.innerHTML = '<p style="color:#ef4444;font-size:11px;padding:16px">Erreur de chargement : ' + e.message + '</p>';
  }
}

// ─── BUTEURS ─────────────────────────────────────────────────────────────────

function renderScorers() {
  var c = document.getElementById('scorers-list');
  if (!c) return;
  c.innerHTML = '';
  if (!scorers.length) {
    c.innerHTML = '<p style="color:#475569;font-size:11px;padding:16px">Aucun buteur enregistré pour l\'instant.</p>';
    return;
  }
  var html = '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
  html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">' +
    '<span style="min-width:20px">#</span><span style="flex:1">Joueur</span>' +
    '<span style="min-width:36px;text-align:center;color:#22c55e">⚽ Buts</span>' +
    '<span style="min-width:36px;text-align:center;color:#0ea5e9">→ Ast.</span></div>';
  for (var i = 0; i < scorers.length; i++) {
    var s = scorers[i];
    var player = s.player || {};
    var team   = s.team   || {};
    var goals   = s.goals    || 0;
    var assists = s.assists  || 0;
    var penalties = s.penalties || 0;
    var rank = i + 1;
    var rankColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : '#475569';
    html += '<div class="scorer-row">' +
      '<span class="scorer-rank" style="color:' + rankColor + '">' + rank + '</span>' +
      '<span class="scorer-name">' + (player.name || '?') +
        '<span style="font-size:9px;color:#64748b;font-weight:400;margin-left:4px">(' + normTeam(team.shortName || team.name || '') + ')</span>' +
        (penalties ? '<span style="font-size:8px;color:#f59e0b;margin-left:4px">(' + penalties + ' pen.)</span>' : '') +
      '</span>' +
      '<span style="font-size:12px;font-weight:800;color:#22c55e;min-width:36px;text-align:center">⚽ ' + goals + '</span>' +
      (assists ? '<span style="font-size:11px;font-weight:700;color:#0ea5e9;min-width:36px;text-align:center">→ ' + assists + '</span>' : '<span style="min-width:36px"></span>') +
      '</div>';
  }
  html += '</div>';
  c.innerHTML = html;
}

// ─── JOUEURS ─────────────────────────────────────────────────────────────────

var playersLoaded = false;

async function fetchPlayerRankings() {
  var c = document.getElementById('players-list');
  if (!c) return;
  c.innerHTML = '<p style="color:#475569;font-size:11px;padding:16px">⏳ Chargement…</p>';

  try {
    var data = await fetch(WORKER_BASE + '/stats/players').then(function(r) { return r.json(); });
    var ranking = data.ranking || [];

    if (!ranking.length) {
      c.innerHTML = '<p style="color:#475569;font-size:11px;padding:16px">Données disponibles dès le premier match joué.</p>';
      return;
    }

    var html = '<div style="background:#080f1e;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;padding:4px 12px;">';
    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:8px;color:#475569;font-weight:700">' +
      '<span style="min-width:20px">#</span>' +
      '<span style="flex:1">Joueur</span>' +
      '<span style="min-width:30px;text-align:center">MJ</span>' +
      '<span style="min-width:30px;text-align:center;color:#22c55e">⚽</span>' +
      '<span style="min-width:30px;text-align:center;color:#0ea5e9">→</span>' +
      '<span style="min-width:36px;text-align:right">Note</span>' +
      '</div>';

    ranking.forEach(function(p, i) {
      var rc = ratingColor(p.rating);
      var rankColor = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569';
      var roleLabel = { 'GK':'Gard.','DEF':'Def.','FB':'Lat.','DM':'M.Def','CM':'Mil.','AM':'M.Off','FW':'Att.' }[p.role] || p.role;
      html += '<div class="scorer-row">' +
        '<span style="min-width:20px;font-size:9px;font-weight:700;color:' + rankColor + '">' + (i + 1) + '</span>' +
        '<span style="flex:1;font-size:10px;color:#e2e8f0">' + p.name +
          '<span style="font-size:8px;color:#475569;margin-left:4px">(' + p.team + ')</span>' +
          '<span style="font-size:7px;color:#334155;margin-left:3px;background:rgba(255,255,255,0.05);border-radius:2px;padding:1px 3px">' + roleLabel + '</span>' +
        '</span>' +
        '<span style="min-width:30px;text-align:center;font-size:9px;color:#475569">' + p.matches + '</span>' +
        (p.goals ? '<span style="min-width:30px;text-align:center;font-size:10px;font-weight:700;color:#22c55e">' + p.goals + '</span>' : '<span style="min-width:30px"></span>') +
        (p.assists ? '<span style="min-width:30px;text-align:center;font-size:10px;font-weight:700;color:#0ea5e9">' + p.assists + '</span>' : '<span style="min-width:30px"></span>') +
        '<span style="min-width:36px;text-align:right;font-size:11px;font-weight:800;color:' + rc + '">' + p.rating.toFixed(1) + '</span>' +
        '</div>';
    });

    html += '</div>';
    c.innerHTML = html;
    playersLoaded = true;

  } catch (e) {
    c.innerHTML = '<p style="color:#ef4444;font-size:11px;padding:16px">Erreur de chargement : ' + e.message + '</p>';
  }
}

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────
