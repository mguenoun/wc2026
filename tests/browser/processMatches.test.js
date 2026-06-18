/**
 * Tests des fonctions pures browser : processMatches, computeStandingsFromMatches,
 * normTeam, processESPNScores.
 *
 * Ces fonctions vivent dans des fichiers de scripts browser (sans export).
 * On les charge via createRequire + vm pour simuler l'environnement global.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, Script } from 'vm';

// ── Chargement des scripts browser dans un contexte global simulé ─────────────

const ROOT = resolve(process.cwd());

function loadScripts(...files) {
  const ctx = { console, Date, parseInt, isNaN, Object, Math, Array, Set, Map, String, Number };
  const context = createContext(ctx);
  for (const f of files) {
    const code = readFileSync(resolve(ROOT, f), 'utf8');
    new Script(code).runInContext(context);
  }
  return context;
}

// Charger config.js (fournit TEAM_MAP, normTeam, GC) puis api.js
let g;
beforeEach(() => {
  g = loadScripts('js/config.js', 'js/api.js');
  // Initialiser les globals attendus par api.js
  g.allMatches = [];
  g.standings  = {};
  g.scorers    = [];
});

// ── normTeam ──────────────────────────────────────────────────────────────────

describe('normTeam', () => {
  it('traduit les noms connus', () => {
    expect(g.normTeam('Brazil')).toBe('Brésil');
    expect(g.normTeam('England')).toBe('Angleterre');
    expect(g.normTeam('United States')).toBe('USA');
    expect(g.normTeam('Morocco')).toBe('Maroc');
  });
  it('retourne le nom tel quel si inconnu', () => {
    expect(g.normTeam('Xyzistan')).toBe('Xyzistan');
    expect(g.normTeam('')).toBe('');
  });
  it('gère les alias (Turkey / Türkiye)', () => {
    expect(g.normTeam('Turkey')).toBe('Turquie');
    expect(g.normTeam('Türkiye')).toBe('Turquie');
  });
});

// ── processMatches ────────────────────────────────────────────────────────────

describe('processMatches', () => {
  const base = [
    { id: 'M1', dayKey: '2026-06-15', t1: 'France', t2: 'Brésil', grp: 'A', ko: false, time: '20h00',
      dateLabel: 'Dimanche 15 juin', color: '#0ea5e9' },
    { id: 'M2', dayKey: '2026-06-15', t1: 'Espagne', t2: 'Argentine', grp: 'B', ko: false, time: '17h00',
      dateLabel: 'Dimanche 15 juin', color: '#06b6d4' },
  ];

  it('ajoute le score FT quand le match est terminé', () => {
    const fdMatches = [{
      utcDate: '2026-06-15T19:00:00Z',
      status: 'FINISHED',
      homeTeam: { name: 'France', shortName: 'FRA' },
      awayTeam: { name: 'Brazil', shortName: 'BRA' },
      score: { fullTime: { home: 2, away: 1 } },
      id: 999,
    }];
    const result = g.processMatches(fdMatches, base);
    const m = result.find(m => m.id === 'M1');
    expect(m.isFT).toBe(true);
    expect(m.score).toBe('2 – 1');
  });

  it('fallback J-1 : utcDate la veille → match trouvé quand même', () => {
    const fdMatches = [{
      utcDate: '2026-06-14T23:00:00Z', // veille UTC = 15 juin heure locale
      status: 'FINISHED',
      homeTeam: { name: 'France', shortName: 'FRA' },
      awayTeam: { name: 'Brazil', shortName: 'BRA' },
      score: { fullTime: { home: 1, away: 0 } },
      id: 999,
    }];
    const result = g.processMatches(fdMatches, base);
    const m = result.find(m => m.id === 'M1');
    expect(m.isFT).toBe(true);
    expect(m.score).toBe('1 – 0');
  });

  it('match sans correspondance → retourné inchangé', () => {
    const result = g.processMatches([], base);
    expect(result[0]).toEqual(base[0]);
  });

  it('ne mute pas inputMatches', () => {
    const snapshot = JSON.stringify(base);
    g.processMatches([], base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('sans inputMatches, met à jour allMatches global', () => {
    g.allMatches = [...base];
    g.processMatches([]);
    expect(Array.isArray(g.allMatches)).toBe(true);
  });
});

// ── computeStandingsFromMatches ───────────────────────────────────────────────

describe('computeStandingsFromMatches', () => {
  const matches = [
    { ko: false, grp: 'A', t1: 'France',  t2: 'Brésil',   isFT: true, score: '2 – 1' },
    { ko: false, grp: 'A', t1: 'Espagne', t2: 'Argentine', isFT: true, score: '1 – 1' },
    { ko: false, grp: 'A', t1: 'France',  t2: 'Espagne',   isFT: true, score: '0 – 0' },
    { ko: false, grp: 'A', t1: 'Brésil',  t2: 'Argentine', isFT: true, score: '3 – 0' },
  ];

  it('calcule correctement les points', () => {
    const result = g.computeStandingsFromMatches(matches);
    const grpA = result['A'];
    const france  = grpA.find(r => r.team === 'France');
    const espagne = grpA.find(r => r.team === 'Espagne');
    const bresil  = grpA.find(r => r.team === 'Brésil');
    const argen   = grpA.find(r => r.team === 'Argentine');

    expect(france.pts).toBe(4);   // 1 victoire + 1 nul
    expect(espagne.pts).toBe(2);  // 2 nuls
    expect(bresil.pts).toBe(3);   // 1 victoire + 1 défaite
    expect(argen.pts).toBe(1);    // 1 nul + 1 défaite
  });

  it('calcule buts pour/contre/diff', () => {
    const result = g.computeStandingsFromMatches(matches);
    const bresil = result['A'].find(r => r.team === 'Brésil');
    expect(bresil.gf).toBe(4); // 1 (vs France) + 3 (vs Argentine)
    expect(bresil.ga).toBe(2); // 2 (vs France) + 0 (vs Argentine)
    expect(bresil.gd).toBe(2);
  });

  it('trie par points puis diff de buts', () => {
    const result = g.computeStandingsFromMatches(matches);
    const pts = result['A'].map(r => r.pts);
    expect(pts).toEqual([...pts].sort((a, b) => b - a));
  });

  it('ignore les matchs KO', () => {
    const withKO = [
      ...matches,
      { ko: true, grp: 'A', t1: 'France', t2: 'Brésil', isFT: true, score: '1 – 0' },
    ];
    const r1 = g.computeStandingsFromMatches(matches);
    const r2 = g.computeStandingsFromMatches(withKO);
    expect(r1['A'].find(r => r.team === 'France').pts)
      .toBe(r2['A'].find(r => r.team === 'France').pts);
  });

  it('ignore les matchs non terminés', () => {
    const withPending = [
      ...matches,
      { ko: false, grp: 'A', t1: 'France', t2: 'Espagne', isFT: false, score: null },
    ];
    const r1 = g.computeStandingsFromMatches(matches);
    const r2 = g.computeStandingsFromMatches(withPending);
    expect(r1['A'].find(r => r.team === 'France').pts)
      .toBe(r2['A'].find(r => r.team === 'France').pts);
  });

  it('sans inputMatches, met à jour standings global', () => {
    g.allMatches = [...matches];
    g.computeStandingsFromMatches();
    expect(g.standings['A']).toBeDefined();
  });

  it('assigne pos=1,2,3,4 dans l\'ordre décroissant de pts/gd/gf', () => {
    const result = g.computeStandingsFromMatches(matches);
    const grpA = result['A'];
    // France : 4pts (1V 1N), Brésil : 3pts (1V 1D), Espagne : 2pts (2N), Argentine : 1pt (1N 1D)
    const byPos = {};
    grpA.forEach(function(r) { byPos[r.pos] = r.team; });
    expect(byPos[1]).toBe('France');
    expect(byPos[2]).toBe('Brésil');
    expect(byPos[3]).toBe('Espagne');
    expect(byPos[4]).toBe('Argentine');
  });

  it('les valeurs pos forment bien la suite 1,2,3,4', () => {
    const result = g.computeStandingsFromMatches(matches);
    const positions = result['A'].map(r => r.pos).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);
  });
});
