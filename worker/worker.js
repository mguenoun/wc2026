/**
 * Cloudflare Worker — WC2026 v7
 *
 * Changements vs v4 :
 * - step3 boucle sur TOUS les groupes d'un match en une seule invocation
 *   (max 4 groupes × 10 appels = 40 sous-requêtes, sous la limite de 50)
 * - Noms d'équipes normalisés (anglais → français)
 * - Logs console dans les crons pour monitoring Observability
 *
 * CRONS :
 *   *\/30 * * * *   → step1 : détecte nouveaux matchs → queue
 *   0 *\/2 * * *    → step2 : fetch URLs du prochain match pending
 *   10 *\/2 * * *   → step3 : traite TOUS les groupes du match en processing
 *   20 *\/2 * * *   → step3 : rattrapage si match non terminé au cycle précédent
 */

const ALLOWED_ORIGINS = [
  'https://mguenoun.github.io',
  'https://wc2026.pages.dev',        // Cloudflare Pages prod (si migration future)
  'http://localhost',
  'http://127.0.0.1',
  'null',
];
// *.pages.dev couvre toutes les preview URLs Cloudflare Pages (staging, PR previews)
const PAGES_DEV_RE = /\.pages\.dev$/;

const FD_BASE   = 'https://api.football-data.org/v4';
const AS_BASE   = 'https://v3.football.api-sports.io';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';

// Normalisation noms d'équipes ESPN (anglais) → noms affichés
const TEAM_NORM = {
  'Mexico':'Mexique','United States':'USA','Brazil':'Brésil','Morocco':'Maroc',
  'South Africa':'Afrique du Sud','South Korea':'Corée du Sud','Korea Republic':'Corée du Sud',
  'Czechia':'Tchéquie','Canada':'Canada','Bosnia-Herzegovina':'Bosnie-H.',
  'Paraguay':'Paraguay','Switzerland':'Suisse','Qatar':'Qatar',
  'Haiti':'Haïti','Scotland':'Écosse','Australia':'Australie','Turkey':'Turquie','Türkiye':'Turquie',
  'France':'France','Germany':'Allemagne','Spain':'Espagne','Argentina':'Argentine',
  'England':'Angleterre','Portugal':'Portugal','Netherlands':'Pays-Bas',
  'Belgium':'Belgique','Italy':'Italie','Croatia':'Croatie','Denmark':'Danemark',
  'Japan':'Japon','Senegal':'Sénégal','Ghana':'Ghana','Cameroon':'Cameroun',
  'Nigeria':'Nigéria','Ivory Coast':'Côte d\'Ivoire',"Côte d'Ivoire":"Côte d'Ivoire",
  'Tunisia':'Tunisie','Algeria':'Algérie','Egypt':'Égypte',
  'Saudi Arabia':'Arabie Saoudite','Iran':'Iran',
  'New Zealand':'Nv-Zélande','Ecuador':'Équateur','Uruguay':'Uruguay',
  'Colombia':'Colombie','Chile':'Chili','Peru':'Pérou','Venezuela':'Venezuela',
  'Jamaica':'Jamaïque','Costa Rica':'Costa Rica','Panama':'Panama','Honduras':'Honduras',
  'El Salvador':'Salvador','Guatemala':'Guatemala','Cuba':'Cuba',
  'Serbia':'Serbie','Ukraine':'Ukraine','Poland':'Pologne','Sweden':'Suède',
  'Norway':'Norvège','Austria':'Autriche','Hungary':'Hongrie','Slovakia':'Slovaquie',
  'Romania':'Roumanie','Albania':'Albanie','Slovenia':'Slovénie','Georgia':'Géorgie',
  'Wales':'Pays de Galles','Northern Ireland':'Irlande du Nord','Ireland':'Irlande',
  'Finland':'Finlande','Greece':'Grèce',
  'Russia':'Russie','Czech Republic':'Tchéquie',
  'Curaçao':'Curaçao','Iraq':'Irak',
  'Cape Verde':'Cap-Vert','Jordan':'Jordanie',
  'Congo DR':'Congo RD','DR Congo':'Congo RD',
  'Uzbekistan':'Ouzbékistan','Bosnia and Herzegovina':'Bosnie-H.',
};

function normTeam(name) {
  return TEAM_NORM[name] || name;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isAllowed(o) {
  if (!o) return false;
  return ALLOWED_ORIGINS.some(x => o === x || o.startsWith(x))
    || PAGES_DEV_RE.test(new URL(o).hostname);
}

function makeCors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResp(data, cors, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const kv = {
  get:    (env, key)        => env.STATS_KV.get(key, { type: 'json' }),
  put:    (env, key, value) => env.STATS_KV.put(key, JSON.stringify(value)),
  delete: (env, key)        => env.STATS_KV.delete(key),
};

// ─── RATING FORMULA V7 ────────────────────────────────────────────────────────

function getRole(pos) {
  const p = (pos || '').toUpperCase().split('-')[0];
  const m = {
    'G':'GK','GK':'GK','CD':'DEF','CB':'DEF','SW':'DEF',
    'RB':'FB','LB':'FB','RWB':'FB','LWB':'FB',
    'DM':'DM','CDM':'DM',
    'CM':'CM','RM':'CM','LM':'CM',
    'AM':'AM','CAM':'AM','SS':'AM',
    'CF':'FW','ST':'FW','F':'FW','FW':'FW',
    'LW':'FW','RW':'FW','RF':'FW','LF':'FW','WF':'FW',
  };
  return m[p] || 'CM';
}

function calcRating(raw, role, minutes) {
  if (!minutes || minutes < 1) return null;
  const p90 = 1 + (90 / minutes - 1) * 0.2;
  const n = {
    passes:     raw.passes     * p90,
    totalPass:  raw.totalPass  * p90,
    duelsWon:   raw.duelsWon   * p90,
    duels:      raw.duels      * p90,
    tackles:    (raw.tackles       || 0) * p90,
    intercept:  (raw.interceptions || 0) * p90,
    clearances: (raw.clearances    || 0) * p90,
    ballRec:    (raw.ballRecovery  || 0) * p90,
    crosses:    (raw.crosses       || 0) * p90,
    progCarries: Math.min(raw.progCarries || 0, 6) * p90,
    shots:      raw.shotsOnTarget || 0,
  };
  const ev = {
    goals: raw.goals, assists: raw.assists,
    saves: raw.saves, cs: raw.cleanSheet,
    yellow: raw.yellow, red: raw.red,
  };
  const passPct = n.totalPass >= 15 ? (n.passes / n.totalPass - 0.75) : 0;
  const duelPct = n.duels >= 3 ? (n.duelsWon / n.duels - 0.50) : 0;

  let base = 6.3, score = 0, off = 0, vol = 0;

  if (role === 'GK') {
    score += ev.saves * 0.35 + ev.cs * 0.30 + passPct * 0.25;
    off = ev.goals * 2.0 + ev.assists * 1.0;
    score += Math.min(off, 2.5) + ev.yellow * -0.3 + ev.red * -1.0;
  } else if (role === 'DEF') {
    vol = n.tackles*0.15 + n.intercept*0.12 + n.clearances*0.10 + n.ballRec*0.06 + duelPct*0.80 + passPct*0.50;
    score += Math.min(vol, 1.8) + ev.cs * 0.35;
    off = ev.goals*1.8 + ev.assists*1.0 + n.shots*0.15;
    score += Math.min(off, 2.5) + ev.yellow * -0.35 + ev.red * -1.0;
  } else if (role === 'FB') {
    vol = n.tackles*0.10 + n.intercept*0.10 + n.clearances*0.06 + duelPct*0.65 + passPct*0.40 + n.crosses*0.15 + n.progCarries*0.08;
    score += Math.min(vol, 1.8) + ev.cs * 0.25;
    off = ev.goals*1.6 + ev.assists*1.0 + n.shots*0.12;
    score += Math.min(off, 2.5) + ev.yellow * -0.30 + ev.red * -1.0;
  } else if (role === 'DM') {
    vol = n.tackles*0.18 + n.intercept*0.15 + n.ballRec*0.12 + n.clearances*0.06 + duelPct*0.75 + passPct*0.60;
    score += Math.min(vol, 1.5);
    off = ev.goals*1.5 + ev.assists*1.0 + n.shots*0.12;
    score += Math.min(off, 2.5) + ev.yellow * -0.30 + ev.red * -1.0;
  } else if (role === 'CM') {
    vol = passPct*0.45 + duelPct*0.45 + n.tackles*0.10 + n.intercept*0.08 + n.ballRec*0.08 + n.progCarries*0.07;
    score += Math.min(vol, 1.2);
    off = ev.goals*1.4 + ev.assists*0.90 + n.shots*0.15;
    score += Math.min(off, 2.5) + ev.yellow * -0.30 + ev.red * -1.0;
  } else if (role === 'AM') {
    vol = n.shots*0.20 + n.progCarries*0.08 + passPct*0.30 + n.tackles*0.06 + n.ballRec*0.05;
    score += Math.min(vol, 1.8);
    off = ev.goals*1.4 + ev.assists*0.90;
    score += Math.min(off, 2.5);
    if (n.shots < 0.5) score -= 0.15;
    score += ev.yellow * -0.30 + ev.red * -1.0;
  } else { // FW
    off = ev.goals*1.5 + n.shots*0.22 + ev.assists*0.80;
    score += Math.min(off, 2.8);
    vol = n.progCarries*0.08 + n.ballRec*0.05 + n.tackles*0.06;
    score += Math.min(vol, 0.6);
    if (n.shots < 0.5) score -= 0.20;
    score += ev.yellow * -0.30 + ev.red * -1.0;
  }
  return Math.round(Math.max(4.0, Math.min(9.5, base + score)) * 10) / 10;
}

// ─── STEP 0 : CACHE KV DES DONNÉES FD (matchs, classements, buteurs) ─────────
// Appelé toutes les 30 min. Met à jour KV de manière différentielle (écrit seulement si changement).
// Réduit les appels frontend : 1 requête worker au lieu de 1 FD + N ESPN.

async function step0_refreshData(env) {
  const token = env.API_TOKEN_FD || env.API_TOKEN;
  if (!token) return { step: 0, error: 'No FD token' };

  let changes = 0;
  const now = Date.now();

  // ── 1. Matchs FD ───────────────────────────────────────────────────────────
  try {
    const resp = await fetch(`${FD_BASE}/competitions/WC/matches`, { headers: { 'X-Auth-Token': token } });
    if (resp.ok) {
      const fdData = await resp.json();
      const cached = await kv.get(env, 'cache:matches') || { byId: {}, lastUpdate: 0 };
      for (const m of (fdData.matches || [])) {
        const key  = String(m.id);
        const sh   = m.score?.fullTime?.home ?? null;
        const sa   = m.score?.fullTime?.away ?? null;
        const prev = cached.byId[key];
        if (!prev || prev.status !== m.status || prev.sh !== sh || prev.sa !== sa) {
          cached.byId[key] = {
            id: m.id, utcDate: m.utcDate, status: m.status, stage: m.stage,
            homeTeam: { name: m.homeTeam?.name, shortName: m.homeTeam?.shortName },
            awayTeam: { name: m.awayTeam?.name, shortName: m.awayTeam?.shortName },
            score: m.score ? { fullTime: { home: sh, away: sa } } : null,
            sh, sa,
          };
          changes++;
        }
      }
      if (changes > 0) { cached.lastUpdate = now; await kv.put(env, 'cache:matches', cached); }
    }
  } catch (e) { console.warn('[step0] FD matches:', e.message); }

  // ── 2. Classements FD (seulement si des matchs ont changé) ────────────────
  if (changes > 0) {
    try {
      const resp = await fetch(`${FD_BASE}/competitions/WC/standings`, { headers: { 'X-Auth-Token': token } });
      if (resp.ok) {
        const data = await resp.json();
        await kv.put(env, 'cache:standings', { standings: data.standings || [], lastUpdate: now });
      }
    } catch (e) { console.warn('[step0] FD standings:', e.message); }
  }

  // ── 3. Buteurs FD (toutes les 3h) ─────────────────────────────────────────
  const cachedScorers = await kv.get(env, 'cache:scorers');
  if (!cachedScorers || (now - (cachedScorers.lastUpdate || 0)) > 3 * 60 * 60 * 1000) {
    try {
      const resp = await fetch(`${FD_BASE}/competitions/WC/scorers?limit=20`, { headers: { 'X-Auth-Token': token } });
      if (resp.ok) {
        const data = await resp.json();
        await kv.put(env, 'cache:scorers', { scorers: data.scorers || [], lastUpdate: now });
      }
    } catch (e) { console.warn('[step0] FD scorers:', e.message); }
  }

  return { step: 0, changes, lastUpdate: now };
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────

async function step1_discover(env) {
  const queue   = await kv.get(env, 'pipeline_queue') || { pending: [], processing: [], done: [] };
  const espnMap = await kv.get(env, 'espn_map') || {};
  let added = 0, newIds = 0;

  // Scanner les 7 derniers jours pour détecter automatiquement les matchs terminés
  const today = new Date();
  const dates = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0,10).replace(/-/g,''));
  }

  for (const dateStr of dates) {
    try {
      const data = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateStr}`).then(r => r.json());
      for (const event of (data.events || [])) {
        const espnId = event.id;
        const completed = event.competitions?.[0]?.status?.type?.completed;
        if (!completed) continue;
        if (espnMap[espnId]) continue; // déjà connu

        // Nouveau match terminé → ajouter à espn_map
        const comp = event.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        espnMap[espnId] = {
          espnId,
          matchKey: '',
          t1: home?.team?.displayName || '',
          t2: away?.team?.displayName || '',
          score: `${home?.score||'0'} – ${away?.score||'0'}`,
          dayKey: `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`,
        };
        newIds++;
      }
    } catch (_) {}
  }

  if (newIds > 0) await kv.put(env, 'espn_map', espnMap);

  // Ajouter les matchs non traités à la queue
  let queueChanged = false;
  for (const espnId of Object.keys(espnMap)) {
    if (queue.done.includes(espnId) || queue.pending.includes(espnId) || queue.processing.includes(espnId)) continue;
    const cachedRaw = await env.STATS_KV.get('match:' + espnId);
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw);
        // startersOnly → le pipeline doit compléter les remplaçants
        if (!parsed.startersOnly) { queue.done.push(espnId); queueChanged = true; continue; }
      } catch (_) { queue.done.push(espnId); queueChanged = true; continue; }
    }
    queue.pending.push(espnId);
    added++;
    queueChanged = true;
  }

  if (queueChanged) await kv.put(env, 'pipeline_queue', queue);
  return { step: 1, newIds, added, pending: queue.pending.length, processing: queue.processing.length, done: queue.done.length };
}

async function step2_fetchUrls(env) {
  const queue = await kv.get(env, 'pipeline_queue');
  if (!queue || !queue.pending.length) return { step: 2, skipped: 'No pending matches' };

  const espnId    = queue.pending[0];
  const espnMap   = await kv.get(env, 'espn_map');
  const matchInfo = espnMap && espnMap[espnId] || {};

  const existingUrls = await env.STATS_KV.get('urls:' + espnId);
  if (existingUrls) {
    queue.pending.shift();
    if (!queue.processing.includes(espnId)) queue.processing.push(espnId);
    await kv.put(env, 'pipeline_queue', queue);
    return { step: 2, espnId, skipped: 'URLs already cached' };
  }

  try {
    const summary = await fetch(`${ESPN_BASE}/summary?event=${espnId}`).then(r => r.json());
    if (!summary.rosters?.length) return { step: 2, espnId, error: 'No rosters' };

    const namesByTeam = summary.rosters.map(team => {
      const map = {};
      (team.roster || []).forEach(p => {
        map[p.jersey] = {
          fullName: p.athlete?.displayName || '',
          pos: p.position?.abbreviation || '',
        };
      });
      return { teamName: normTeam(team.team?.displayName || ''), map };
    });

    const d1 = await fetch(`${ESPN_CORE}/events/${espnId}/competitions/${espnId}/competitors`).then(r => r.json());
    const players = [];
    let teamIdx = 0;

    for (const item of d1.items) {
      const comp   = await fetch(item.$ref.replace('http://', 'https://')).then(r => r.json());
      const roster = await fetch(comp.roster.$ref.replace('http://', 'https://')).then(r => r.json());
      const teamInfo = namesByTeam[teamIdx++] || { teamName: '?', map: {} };

      for (const e of (roster.entries || [])) {
        const info = teamInfo.map[e.jersey] || { fullName: '', pos: '' };
        if (!info.fullName) continue;
        players.push({
          statsUrl:  e.statistics.$ref.replace('http://', 'https://'),
          fullName:  info.fullName,
          pos:       info.pos,
          team:      teamInfo.teamName,
          starter:   e.starter   || false,
          subbedIn:  e.subbedIn  || false,
          subbedOut: e.subbedOut || false,
        });
      }
    }

    await kv.put(env, 'urls:' + espnId, {
      espnId,
      matchKey:   matchInfo.matchKey || '',
      home:       normTeam(matchInfo.t1 || ''),
      away:       normTeam(matchInfo.t2 || ''),
      score:      matchInfo.score || '',
      players,
      groupsDone: [],
    });

    queue.pending.shift();
    queue.processing.push(espnId);
    await kv.put(env, 'pipeline_queue', queue);

    return { step: 2, espnId, players: players.length };
  } catch (e) {
    return { step: 2, espnId, error: e.message };
  }
}

// Step 3 amélioré : boucle sur TOUS les groupes restants en une invocation
// Limite : 4 groupes max par invocation (4 × 10 = 40 sous-requêtes + overhead ≤ 50)
async function step3_fetchStats(env) {
  const queue = await kv.get(env, 'pipeline_queue');
  if (!queue || !queue.processing.length) return { step: 3, skipped: 'No matches in processing' };

  const espnId  = queue.processing[0];
  const urlData = await kv.get(env, 'urls:' + espnId);
  if (!urlData) return { step: 3, espnId, error: 'No URL data in KV' };

  const players     = urlData.players || [];
  const groupSize   = 10;
  const totalGroups = Math.ceil(players.length / groupSize);
  const MAX_GROUPS_PER_INVOCATION = 4; // max 40 sous-requêtes

  let groupsProcessed = 0;
  let totalFetched    = 0;

  // Boucler sur les groupes restants (max MAX_GROUPS_PER_INVOCATION)
  while (groupsProcessed < MAX_GROUPS_PER_INVOCATION) {
    const groupsDone = urlData.groupsDone || [];

    // Trouver le prochain groupe non traité
    let nextGroup = -1;
    for (let i = 0; i < totalGroups; i++) {
      if (!groupsDone.includes(i)) { nextGroup = i; break; }
    }

    // Tous les groupes traités → assembler
    if (nextGroup === -1) {
      const result = await assemble(env, espnId, urlData, queue, totalGroups);
      return { ...result, groupsProcessed, totalFetched };
    }

    // Fetch le groupe en séquence
    const start   = nextGroup * groupSize;
    const end     = Math.min(start + groupSize, players.length);
    const group   = players.slice(start, end);
    const partial = {};

    for (const p of group) {
      try {
        const s = await fetch(p.statsUrl).then(r => r.json());
        const gs = (cat, name) => {
          const c = (s.splits?.categories || []).find(x => x.name === cat);
          return c?.stats?.find(x => x.name === name)?.value || 0;
        };
        const minutes = gs('general', 'minutes');
        const role    = getRole(p.pos);
        const raw = {
          goals: gs('offensive','totalGoals'), assists: gs('offensive','goalAssists'),
          passes: gs('offensive','accuratePasses'), totalPass: gs('offensive','totalPasses'),
          shotsOnTarget: gs('offensive','shotsOnTarget'),
          progCarries: gs('offensive','progressiveCarries'),
          crosses: gs('offensive','accurateCrosses'),
          duelsWon: gs('general','duelsWon') || gs('general','groundDuelsWon'),
          duels: gs('general','duels') || gs('general','groundDuels'),
          saves: gs('goalKeeping','saves'), cleanSheet: gs('goalKeeping','cleanSheet'),
          tackles: gs('defensive','effectiveTackles'),
          interceptions: gs('defensive','interceptions'),
          clearances: gs('defensive','effectiveClearance'),
          ballRecovery: gs('defensive','ballRecovery'),
          yellow: gs('general','yellowCards'), red: gs('general','redCards'),
        };
        partial[p.fullName] = {
          rating: calcRating(raw, role, minutes),
          minutes, goals: raw.goals, assists: raw.assists,
          saves: raw.saves, yellow: raw.yellow, red: raw.red,
          starter: p.starter, subbedIn: p.subbedIn, subbedOut: p.subbedOut,
          team: p.team, pos: p.pos, role,
        };
        totalFetched++;
      } catch (_) {}
    }

    // Stocker le partiel + mettre à jour groupsDone
    await kv.put(env, `partial:${espnId}:${nextGroup}`, partial);
    urlData.groupsDone = [...(urlData.groupsDone || []), nextGroup];
    await kv.put(env, 'urls:' + espnId, urlData);
    groupsProcessed++;
  }

  // Max groupes atteint — le prochain cron continuera
  const remaining = totalGroups - (urlData.groupsDone || []).length;
  return { step: 3, espnId, groupsProcessed, totalFetched, remaining, status: 'partial - next cron will continue' };
}

async function assemble(env, espnId, urlData, queue, totalGroups) {
  const stats = {};
  for (let i = 0; i < totalGroups; i++) {
    const partial = await kv.get(env, `partial:${espnId}:${i}`);
    if (partial) Object.assign(stats, partial);
    await kv.delete(env, `partial:${espnId}:${i}`);
  }
  await kv.delete(env, 'urls:' + espnId);

  await kv.put(env, 'match:' + espnId, {
    stats, espnId,
    matchKey: urlData.matchKey,
    home: urlData.home,
    away: urlData.away,
    score: urlData.score,
    cachedAt: Date.now(),
  });

  queue.processing = queue.processing.filter(id => id !== espnId);
  queue.done.push(espnId);
  await kv.put(env, 'pipeline_queue', queue);

  return { step: 3, espnId, assembled: true, players: Object.keys(stats).length };
}

// ─── ON-DEMAND : titulaires uniquement (<30 sous-requêtes) ───────────────────
// Déclenché quand le frontend demande /data/stats/:espnId et que le KV est vide.
// Calcule et stocke les notes des 22 titulaires, flagge startersOnly:true.
// Le pipeline cron complètera les remplaçants lors de la prochaine exécution.

async function computeOnDemand(env, espnId) {
  // 1. ESPN summary → noms/postes/starter flag (1 sous-requête)
  const summary = await fetch(`${ESPN_BASE}/summary?event=${espnId}`).then(r => r.json());
  const state = summary.header?.competitions?.[0]?.status?.type?.state || 'pre';
  if (state !== 'post') return null; // uniquement pour les matchs terminés

  if (!summary.rosters?.length) return null;

  const namesByTeam = summary.rosters.map(team => {
    const map = {};
    (team.roster || []).forEach(p => {
      map[p.jersey] = { fullName: p.athlete?.displayName || '', pos: p.position?.abbreviation || '' };
    });
    return { teamName: normTeam(team.team?.displayName || ''), map };
  });

  const hdr   = summary.header?.competitions?.[0];
  const hComp = hdr?.competitors?.find(c => c.homeAway === 'home') || {};
  const aComp = hdr?.competitors?.find(c => c.homeAway === 'away') || {};
  const home  = normTeam(hComp.team?.displayName || '');
  const away  = normTeam(aComp.team?.displayName || '');
  const score = `${hComp.score || '0'} – ${aComp.score || '0'}`;

  // 2. ESPN Core → URLs stats (1 + 2 + 2 = 5 sous-requêtes)
  const d1 = await fetch(`${ESPN_CORE}/events/${espnId}/competitions/${espnId}/competitors`).then(r => r.json());
  const players = [];
  let teamIdx = 0;

  for (const item of d1.items) {
    const comp   = await fetch(item.$ref.replace('http://', 'https://')).then(r => r.json());
    const roster = await fetch(comp.roster.$ref.replace('http://', 'https://')).then(r => r.json());
    const teamInfo = namesByTeam[teamIdx++] || { teamName: '?', map: {} };
    for (const e of (roster.entries || [])) {
      const info = teamInfo.map[e.jersey] || { fullName: '', pos: '' };
      if (!info.fullName) continue;
      players.push({
        statsUrl:  e.statistics.$ref.replace('http://', 'https://'),
        fullName:  info.fullName, pos: info.pos, team: teamInfo.teamName,
        starter: e.starter || false, subbedIn: e.subbedIn || false, subbedOut: e.subbedOut || false,
      });
    }
  }

  // 3. Stats titulaires seulement (~22 sous-requêtes)
  const stats = {};
  for (const p of players.filter(p => p.starter)) {
    try {
      const s = await fetch(p.statsUrl).then(r => r.json());
      const gs = (cat, name) => {
        const c = (s.splits?.categories || []).find(x => x.name === cat);
        return c?.stats?.find(x => x.name === name)?.value || 0;
      };
      const minutes = gs('general', 'minutes');
      const role    = getRole(p.pos);
      const raw = {
        goals: gs('offensive','totalGoals'), assists: gs('offensive','goalAssists'),
        passes: gs('offensive','accuratePasses'), totalPass: gs('offensive','totalPasses'),
        shotsOnTarget: gs('offensive','shotsOnTarget'),
        progCarries: gs('offensive','progressiveCarries'),
        crosses: gs('offensive','accurateCrosses'),
        duelsWon: gs('general','duelsWon') || gs('general','groundDuelsWon'),
        duels: gs('general','duels') || gs('general','groundDuels'),
        saves: gs('goalKeeping','saves'), cleanSheet: gs('goalKeeping','cleanSheet'),
        tackles: gs('defensive','effectiveTackles'),
        interceptions: gs('defensive','interceptions'),
        clearances: gs('defensive','effectiveClearance'),
        ballRecovery: gs('defensive','ballRecovery'),
        yellow: gs('general','yellowCards'), red: gs('general','redCards'),
      };
      stats[p.fullName] = {
        rating: calcRating(raw, role, minutes),
        minutes, goals: raw.goals, assists: raw.assists,
        saves: raw.saves, yellow: raw.yellow, red: raw.red,
        starter: p.starter, subbedIn: p.subbedIn, subbedOut: p.subbedOut,
        team: p.team, pos: p.pos, role,
      };
    } catch (_) {}
  }

  if (!Object.keys(stats).length) return null;

  // 4. Stocker en KV — startersOnly:true signale au pipeline de compléter les remplaçants
  await kv.put(env, 'match:' + espnId, {
    stats, espnId, matchKey: '', home, away, score,
    cachedAt: Date.now(), startersOnly: true,
  });

  console.log(`[ondemand] ${espnId} ${home} ${away} — ${Object.keys(stats).length} titulaires mis en cache`);
  return stats;
}

// ─── LECTURE KV ───────────────────────────────────────────────────────────────

async function handlePlayers(env, cors) {
  const list = await env.STATS_KV.list({ prefix: 'match:' });
  const agg  = {};
  for (const key of list.keys) {
    const data = await kv.get(env, key.name);
    if (!data?.stats) continue;
    for (const [name, s] of Object.entries(data.stats)) {
      if (!s.rating || !s.minutes || s.role === 'GK') continue;
      if (!agg[name]) agg[name] = { team: s.team, role: s.role, totalRating: 0, totalMinutes: 0, goals: 0, assists: 0, matches: 0 };
      agg[name].totalRating  += s.rating * s.minutes;
      agg[name].totalMinutes += s.minutes;
      agg[name].goals        += s.goals   || 0;
      agg[name].assists      += s.assists || 0;
      agg[name].matches++;
    }
  }
  const ranking = Object.entries(agg)
    .filter(([, a]) => a.totalMinutes >= 45)
    .map(([name, a]) => ({
      name, team: a.team, role: a.role,
      rating:  Math.round(a.totalRating / a.totalMinutes * 10) / 10,
      minutes: a.totalMinutes, goals: a.goals, assists: a.assists, matches: a.matches,
    }))
    .sort((a, b) => (b.rating - a.rating) || (b.goals - a.goals) || (b.assists - a.assists));
  return jsonResp({ ranking, cachedAt: Date.now() }, cors);
}

async function handleKeepers(env, cors) {
  const list = await env.STATS_KV.list({ prefix: 'match:' });
  const gks  = {};
  for (const key of list.keys) {
    const data = await kv.get(env, key.name);
    if (!data?.stats) continue;
    const parts = (data.score || '').split('–').map(x => parseInt(x.trim()) || 0);
    for (const [name, s] of Object.entries(data.stats)) {
      if (s.role !== 'GK' || !s.starter) continue;
      const ga = parts.length === 2 ? (s.team === data.home ? parts[1] : parts[0]) : 0;
      if (!gks[name]) gks[name] = { team: s.team, saves: 0, ga: 0, cleanSheets: 0, minutes: 0, matches: 0 };
      gks[name].saves   += s.saves || 0;
      gks[name].ga      += ga;
      gks[name].minutes += s.minutes || 90;
      gks[name].matches++;
      if (ga === 0) gks[name].cleanSheets++;
    }
  }
  const ranking = Object.entries(gks)
    .map(([name, k]) => ({ name, ...k }))
    .sort((a, b) => (a.ga - b.ga) || (b.saves - a.saves));
  return jsonResp({ ranking, cachedAt: Date.now() }, cors);
}

async function handleFairPlay(env, cors) {
  const list = await env.STATS_KV.list({ prefix: 'match:' });
  const teams = {};
  for (const key of list.keys) {
    const data = await kv.get(env, key.name);
    if (!data?.stats) continue;
    for (const [, s] of Object.entries(data.stats)) {
      if (!s.team) continue;
      const t = normTeam(s.team);
      if (!teams[t]) teams[t] = { team: t, yc: 0, rc: 0 };
      teams[t].yc += s.yellow || 0;
      teams[t].rc += s.red    || 0;
    }
  }
  const fairplay = Object.values(teams).sort((a, b) =>
    (a.yc + 3 * a.rc) - (b.yc + 3 * b.rc) || a.yc - b.yc
  );
  return jsonResp({ fairplay, cachedAt: Date.now() }, cors);
}

async function handleStatus(env, cors) {
  const queue   = await kv.get(env, 'pipeline_queue') || { pending: [], processing: [], done: [] };
  const espnMap = await kv.get(env, 'espn_map') || {};
  const matches = await env.STATS_KV.list({ prefix: 'match:' });
  const urls    = await env.STATS_KV.list({ prefix: 'urls:' });
  const partial = await env.STATS_KV.list({ prefix: 'partial:' });

  // Détail de progression pour les matchs en cours
  let processingDetail = null;
  if (queue.processing.length > 0) {
    const eid     = queue.processing[0];
    const urlData = await kv.get(env, 'urls:' + eid);
    if (urlData) {
      const total = Math.ceil((urlData.players || []).length / 10);
      processingDetail = { espnId: eid, groupsDone: (urlData.groupsDone || []).length, totalGroups: total };
    }
  }

  return jsonResp({
    espnMap:  Object.keys(espnMap).length,
    queue,
    processingDetail,
    kv: { matches: matches.keys.length, urls: urls.keys.length, partials: partial.keys.length },
    lastChecked: new Date().toISOString(),
  }, cors);
}

async function handleInit(request, env, cors) {
  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResp({ error: 'Invalid JSON' }, cors, 400); }

  const mapping = body.mapping || {};
  if (!Object.keys(mapping).length) return jsonResp({ error: 'Empty mapping' }, cors, 400);

  await kv.put(env, 'espn_map', mapping);

  // forceReset : vider toutes les clés KV existantes avant de recommencer
  if (body.forceReset) {
    console.log('[INIT] forceReset: clearing KV...');
    const toDelete = ['match:', 'urls:', 'partial:'];
    for (const prefix of toDelete) {
      const list = await env.STATS_KV.list({ prefix });
      for (const key of list.keys) await env.STATS_KV.delete(key.name);
    }
    console.log('[INIT] KV cleared');
  }

  await kv.put(env, 'pipeline_queue', { pending: [], processing: [], done: [] });

  const step1 = await step1_discover(env);
  return jsonResp({ ok: true, espnIds: Object.keys(mapping).length, step1 }, cors);
}

// ─── PROXY ────────────────────────────────────────────────────────────────────

async function proxy(upstream, headers, cors) {
  try {
    const resp = await fetch(upstream, { headers });
    return new Response(await resp.text(), {
      status: resp.status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response('Upstream error: ' + e.message, { status: 502, headers: cors });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || 'null';
    if (!isAllowed(origin)) return new Response('Forbidden', { status: 403 });
    const cors = makeCors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'POST' && new URL(request.url).pathname === '/stats/init') return handleInit(request, env, cors);

    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/stats/players')   return handlePlayers(env, cors);
    if (path === '/stats/keepers')   return handleKeepers(env, cors);
    if (path === '/stats/fairplay')  return handleFairPlay(env, cors);
    if (path === '/stats/status')    return handleStatus(env, cors);
    if (path === '/stats/step1')   return jsonResp(await step1_discover(env),   cors);
    if (path === '/stats/step2')   return jsonResp(await step2_fetchUrls(env),  cors);
    if (path === '/stats/step3')   return jsonResp(await step3_fetchStats(env), cors);

    // ── Cache KV côté worker (données pré-agrégées pour le frontend) ──────────
    if (path === '/data/matches') {
      const c = await kv.get(env, 'cache:matches');
      return jsonResp({ matches: c ? Object.values(c.byId) : [], lastUpdate: c?.lastUpdate || 0 }, cors);
    }
    if (path === '/data/standings') {
      const c = await kv.get(env, 'cache:standings');
      return jsonResp(c || { standings: [], lastUpdate: 0 }, cors);
    }
    if (path === '/data/scorers') {
      const c = await kv.get(env, 'cache:scorers');
      return jsonResp(c || { scorers: [], lastUpdate: 0 }, cors);
    }
    if (path === '/data/refresh') return jsonResp(await step0_refreshData(env), cors);

    if (path.startsWith('/data/summary/')) {
      const espnId = path.split('/')[3];
      if (!espnId) return new Response('Missing espnId', { status: 400, headers: cors });
      const cached = await kv.get(env, 'cache:summary:' + espnId);
      // Retourner le cache si : match terminé (permanent) ou match live < 60s
      if (cached) {
        if (cached.state === 'post') return jsonResp(cached.data, cors);
        if (cached.state === 'in' && (Date.now() - (cached.lastUpdate || 0)) < 60_000) return jsonResp(cached.data, cors);
      }
      try {
        const r = await fetch(`${ESPN_BASE}/summary?event=${espnId}`);
        if (!r.ok) return new Response('ESPN error', { status: r.status, headers: cors });
        const data = await r.json();
        const state = data?.header?.competitions?.[0]?.status?.type?.state || 'pre';
        if (state === 'post' || state === 'in') {
          await kv.put(env, 'cache:summary:' + espnId, { data, state, lastUpdate: Date.now() });
        }
        return jsonResp(data, cors);
      } catch (e) { return new Response('Fetch error', { status: 502, headers: cors }); }
    }

    if (path.startsWith('/data/stats/')) {
      const espnId = path.split('/')[3];
      if (!espnId) return new Response('Missing espnId', { status: 400, headers: cors });
      const m = await kv.get(env, 'match:' + espnId);
      if (m?.stats) return jsonResp({ stats: m.stats, cachedAt: m.cachedAt, startersOnly: m.startersOnly || false }, cors);
      // KV miss → calcul on-demand des titulaires
      try {
        const stats = await computeOnDemand(env, espnId);
        if (stats) return jsonResp({ stats, cachedAt: Date.now(), startersOnly: true }, cors);
      } catch (e) {
        console.warn('[ondemand]', espnId, e.message);
      }
      return jsonResp({ stats: null }, cors);
    }



    if (path.startsWith('/fd/')) {
      const token = env.API_TOKEN_FD || env.API_TOKEN;
      if (!token) return new Response('API_TOKEN_FD not set', { status: 500, headers: cors });
      return proxy(FD_BASE + path.slice(3) + url.search, { 'X-Auth-Token': token }, cors);
    }
    if (path.startsWith('/as/')) {
      const token = env.API_TOKEN_AS;
      if (!token) return new Response('API_TOKEN_AS not set', { status: 500, headers: cors });
      return proxy(AS_BASE + path.slice(3) + url.search, { 'x-apisports-key': token }, cors);
    }

    return new Response('Unknown route', { status: 400, headers: cors });
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;
    const ts   = new Date().toISOString();
    console.log(`[CRON] ${cron} fired at ${ts}`);

    if (cron === '*/30 * * * *') {
      const result0 = await step0_refreshData(env);
      console.log(`[CRON] step0 result: ${JSON.stringify(result0)}`);
      const result1 = await step1_discover(env);
      console.log(`[CRON] step1 result: ${JSON.stringify(result1)}`);
      ctx.waitUntil(Promise.resolve());
    }

    if (cron === '0 */2 * * *') {
      const result = await step2_fetchUrls(env);
      console.log(`[CRON] step2 result: ${JSON.stringify(result)}`);
      ctx.waitUntil(Promise.resolve());
    }

    if (cron === '10 */2 * * *' || cron === '20 */2 * * *') {
      const result = await step3_fetchStats(env);
      console.log(`[CRON] step3 result: ${JSON.stringify(result)}`);
      ctx.waitUntil(Promise.resolve());
    }
  },
};

export { calcRating, getRole };
