/**
 * Tests des fonctions pures de render.js : getAll3rd, buildThirdAssign, resolveKOTeam.
 * Ces fonctions n'ont aucune dépendance DOM — elles opèrent uniquement sur les
 * globaux standings, allMatches et _thirdAssign.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, Script } from 'vm';

const ROOT = resolve(process.cwd());

function loadRenderCtx() {
  const ctx = { console, Date, parseInt, isNaN, Object, Math, Array, Set, Map, String, Number };
  const context = createContext(ctx);
  for (const f of ['js/config.js', 'js/render.js']) {
    new Script(readFileSync(resolve(ROOT, f), 'utf8')).runInContext(context);
  }
  return context;
}

/** Construit un tableau standings[g] avec pos assigné selon l'ordre */
function mkGroup(...teams) {
  return teams.map((t, i) => ({ pos: i + 1, played: 3, ...t }));
}

let g;
beforeEach(() => {
  g = loadRenderCtx();
  g.allMatches = [];
  g.standings   = {};
  g._thirdAssign = null;
});

// ── getAll3rd ─────────────────────────────────────────────────────────────────

describe('getAll3rd', () => {
  it('retourne la 3e place d\'un groupe ayant joué', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 6, gd: 2, gf: 4 },
        { team: 'A3', pts: 3, gd: -1, gf: 2 },
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
    };
    const r = g.getAll3rd();
    expect(r).toHaveLength(1);
    expect(r[0].team).toBe('A3');
    expect(r[0].group).toBe('A');
    expect(r[0].pts).toBe(3);
    expect(r[0].coTeam).toBeNull();
  });

  it('ignore un groupe où personne n\'a joué (played=0 pour tous)', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 0, gd: 0, gf: 0, played: 0 },
        { team: 'A2', pts: 0, gd: 0, gf: 0, played: 0 },
        { team: 'A3', pts: 0, gd: 0, gf: 0, played: 0 },
        { team: 'A4', pts: 0, gd: 0, gf: 0, played: 0 },
      ),
    };
    expect(g.getAll3rd()).toHaveLength(0);
  });

  it('inclut un groupe dès qu\'au moins 1 équipe a joué', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 3, gd: 1, gf: 1, played: 1 },
        { team: 'A2', pts: 0, gd: -1, gf: 0, played: 1 },
        { team: 'A3', pts: 0, gd: 0, gf: 0, played: 0 },
        { team: 'A4', pts: 0, gd: 0, gf: 0, played: 0 },
      ),
    };
    expect(g.getAll3rd()).toHaveLength(1);
  });

  it('détecte ex æquo : coTeam renseigné quand pos=2 et pos=3 ont mêmes stats', () => {
    // Scénario Brésil/Maroc : nul 1-1, Écosse gagne M14
    g.standings = {
      C: mkGroup(
        { team: 'Écosse', pts: 3, gd:  1, gf: 1, played: 1 },
        { team: 'Brésil', pts: 1, gd:  0, gf: 1, played: 1 },
        { team: 'Maroc',  pts: 1, gd:  0, gf: 1, played: 1 },
        { team: 'Haïti',  pts: 0, gd: -1, gf: 0, played: 1 },
      ),
    };
    const r = g.getAll3rd();
    expect(r).toHaveLength(1);
    expect(r[0].team).toBe('Maroc');    // pos=3
    expect(r[0].coTeam).toBe('Brésil'); // pos=2 ex æquo
  });

  it('pas de coTeam quand 2e et 3e ont des stats différentes', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 6, gd: 2, gf: 4 },
        { team: 'A3', pts: 3, gd: -1, gf: 2 },
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
    };
    expect(g.getAll3rd()[0].coTeam).toBeNull();
  });

  it('pas de coTeam si même pts mais gd différent', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 4, gd: 2, gf: 4 },
        { team: 'A3', pts: 4, gd: 1, gf: 3 }, // même pts, gd différent
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
    };
    expect(g.getAll3rd()[0].coTeam).toBeNull();
  });

  it('trie les 3es par pts puis gd puis gf', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 6, gd: 2, gf: 4 },
        { team: 'A3', pts: 4, gd: 1, gf: 4 }, // 4pts
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
      B: mkGroup(
        { team: 'B1', pts: 9, gd: 4, gf: 5 },
        { team: 'B2', pts: 6, gd: 1, gf: 3 },
        { team: 'B3', pts: 3, gd: 0, gf: 2 }, // 3pts
        { team: 'B4', pts: 0, gd: -5, gf: 0 },
      ),
    };
    const r = g.getAll3rd();
    expect(r[0].team).toBe('A3'); // 4pts > 3pts
    expect(r[1].team).toBe('B3');
  });

  it('trie par gd en cas d\'égalité de pts', () => {
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 6, gd: 2, gf: 4 },
        { team: 'A3', pts: 3, gd: 2, gf: 4 }, // meilleures gd
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
      B: mkGroup(
        { team: 'B1', pts: 9, gd: 4, gf: 5 },
        { team: 'B2', pts: 6, gd: 1, gf: 3 },
        { team: 'B3', pts: 3, gd: -1, gf: 2 }, // moins bon gd
        { team: 'B4', pts: 0, gd: -5, gf: 0 },
      ),
    };
    const r = g.getAll3rd();
    expect(r[0].team).toBe('A3');
    expect(r[1].team).toBe('B3');
  });

  it('retourne un tableau vide si standings vide', () => {
    g.standings = {};
    expect(g.getAll3rd()).toHaveLength(0);
  });

  it('deux 3es sans coTeam à stats identiques → même rang, le suivant est +2 (1,1,3)', () => {
    // A3 et B3 : mêmes stats, aucun coTeam → chacun pèse 1 → prochain rang = 1+2 = 3
    g.standings = {
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 5, gf: 6 },
        { team: 'A2', pts: 6, gd: 2, gf: 4 },
        { team: 'A3', pts: 4, gd: 1, gf: 3 },
        { team: 'A4', pts: 0, gd: -6, gf: 0 },
      ),
      B: mkGroup(
        { team: 'B1', pts: 9, gd: 4, gf: 5 },
        { team: 'B2', pts: 6, gd: 1, gf: 3 },
        { team: 'B3', pts: 4, gd: 1, gf: 3 }, // même stats que A3
        { team: 'B4', pts: 0, gd: -5, gf: 0 },
      ),
      C: mkGroup(
        { team: 'C1', pts: 9, gd: 3, gf: 4 },
        { team: 'C2', pts: 6, gd: 1, gf: 2 },
        { team: 'C3', pts: 2, gd: 0, gf: 1 }, // inférieur
        { team: 'C4', pts: 0, gd: -4, gf: 0 },
      ),
    };
    const r = g.getAll3rd();
    expect(r[0].pts).toBe(4); expect(r[0].gd).toBe(1); expect(r[0].gf).toBe(3);
    expect(r[1].pts).toBe(4); expect(r[1].gd).toBe(1); expect(r[1].gf).toBe(3);
    // Stats identiques → même rang (1) ; C3 inférieur sera au rang 3 (pas 2)
    expect(r[0].pts === r[1].pts && r[0].gd === r[1].gd && r[0].gf === r[1].gf).toBe(true);
    expect(r[2].team).toBe('C3');
  });

  it('entrée coTeam = 1 ligne (pas 2 positions) : [coTeam(BP=2), simple(BP=1)] → rangs 1, 2', () => {
    // Un couple coTeam occupe 1 ligne → la ligne suivante est rang 2, pas rang 3
    g.standings = {
      F: [
        { pos: 1, team: 'F1', pts: 9, gd: 5, gf: 6, played: 1 },
        { pos: 2, team: 'Japon',       pts: 1, gd: 0, gf: 2, played: 1 },
        { pos: 3, team: 'Netherlands', pts: 1, gd: 0, gf: 2, played: 1 }, // ex æquo intra-groupe
        { pos: 4, team: 'F4', pts: 0, gd: -5, gf: 0, played: 1 },
      ],
      A: mkGroup(
        { team: 'A1', pts: 9, gd: 4, gf: 5 },
        { team: 'A2', pts: 6, gd: 1, gf: 3 },
        { team: 'A3', pts: 1, gd: 0, gf: 1 }, // BP=1 < BP=2 → inférieur
        { team: 'A4', pts: 0, gd: -5, gf: 0 },
      ),
    };
    const r = g.getAll3rd();
    // F3 (Netherlands) a un coTeam=Japon, stats supérieures (BP=2 > BP=1)
    expect(r[0].coTeam).toBe('Japon');
    expect(r[0].gf).toBe(2);
    // A3 sans coTeam, stats inférieures → deuxième entry
    expect(r[1].team).toBe('A3');
    expect(r[1].coTeam).toBeNull();
    // Stats différentes → dispRanks [1, 2] dans renderThirds (couple = 1 ligne = 1 position)
    expect(r[0].gf > r[1].gf).toBe(true);
  });
});

// ── resolveKOTeam ─────────────────────────────────────────────────────────────

describe('resolveKOTeam', () => {
  beforeEach(() => {
    g.standings = {
      A: [
        { pos: 1, team: 'France',  pts: 9, gd: 5, gf: 6, played: 3 },
        { pos: 2, team: 'Brésil',  pts: 6, gd: 2, gf: 4, played: 3 },
        { pos: 3, team: 'Maroc',   pts: 3, gd: -1, gf: 2, played: 3 },
        { pos: 4, team: 'Haïti',   pts: 0, gd: -6, gf: 0, played: 3 },
      ],
    };
  });

  it('"1er Gr.A" → 1er du groupe A', () => {
    expect(g.resolveKOTeam('1er Gr.A')).toBe('France');
  });

  it('"2e Gr.A" → 2e du groupe A (pas d\'ex æquo)', () => {
    expect(g.resolveKOTeam('2e Gr.A')).toBe('Brésil');
  });

  it('"1er Gr.Z" (groupe inconnu) → null', () => {
    expect(g.resolveKOTeam('1er Gr.Z')).toBeNull();
  });

  it('"2e Gr.C" ex æquo 1er/2e → retourne le même couple que "1er Gr.C"', () => {
    // Si 1er et 2e ont les mêmes stats, les slots "1er" ET "2e" affichent le même couple
    g.standings = {
      C: [
        { pos: 1, team: 'France',  pts: 4, gd: 1, gf: 2, played: 2 },
        { pos: 2, team: 'Espagne', pts: 4, gd: 1, gf: 2, played: 2 }, // ex æquo avec 1er
        { pos: 3, team: 'Brésil',  pts: 1, gd: -1, gf: 1, played: 2 },
        { pos: 4, team: 'Haïti',   pts: 0, gd: -1, gf: 0, played: 2 },
      ],
    };
    expect(g.resolveKOTeam('1er Gr.C')).toBe('France / Espagne');
    expect(g.resolveKOTeam('2e Gr.C')).toBe('France / Espagne'); // même couple dans les 2 slots
  });

  it('"2e Gr.C" ex æquo → retourne les deux équipes (scénario Brésil/Maroc)', () => {
    g.standings = {
      C: [
        { pos: 1, team: 'Écosse', pts: 3, gd:  1, gf: 1, played: 1 },
        { pos: 2, team: 'Maroc',  pts: 1, gd:  0, gf: 1, played: 1 },
        { pos: 3, team: 'Brésil', pts: 1, gd:  0, gf: 1, played: 1 },
        { pos: 4, team: 'Haïti',  pts: 0, gd: -1, gf: 0, played: 1 },
      ],
    };
    expect(g.resolveKOTeam('2e Gr.C')).toBe('Maroc / Brésil');
  });

  it('"1er Gr.C" ex æquo 1er/2e → retourne les deux équipes', () => {
    g.standings = {
      C: [
        { pos: 1, team: 'France',   pts: 4, gd: 1, gf: 2, played: 2 },
        { pos: 2, team: 'Espagne',  pts: 4, gd: 1, gf: 2, played: 2 },
        { pos: 3, team: 'Brésil',   pts: 1, gd: -1, gf: 1, played: 2 },
        { pos: 4, team: 'Haïti',    pts: 0, gd: -1, gf: 0, played: 2 },
      ],
    };
    expect(g.resolveKOTeam('1er Gr.C')).toBe('France / Espagne');
  });

  it('"2e Gr.A" sans ex æquo → retourne une seule équipe', () => {
    expect(g.resolveKOTeam('2e Gr.A')).toBe('Brésil');
  });

  it('"3e A/B/C" → lit _thirdAssign', () => {
    g._thirdAssign = new Map([['3e A/B/C', 'Maroc']]);
    expect(g.resolveKOTeam('3e A/B/C')).toBe('Maroc');
  });

  it('"3e A/B/C" → null si _thirdAssign est null', () => {
    g._thirdAssign = null;
    expect(g.resolveKOTeam('3e A/B/C')).toBeNull();
  });

  it('"3e A/B/C" → null si clé absente de _thirdAssign', () => {
    g._thirdAssign = new Map([['3e D/E/F', 'Allemagne']]);
    expect(g.resolveKOTeam('3e A/B/C')).toBeNull();
  });

  it('"V M45" → vainqueur du match M45', () => {
    g.allMatches = [{ id: 'M45', isFT: true, score: '2 – 0', t1: 'France', t2: 'Brésil' }];
    expect(g.resolveKOTeam('V M45')).toBe('France');
  });

  it('"V M45" → équipe 2 si elle gagne', () => {
    g.allMatches = [{ id: 'M45', isFT: true, score: '0 – 1', t1: 'France', t2: 'Brésil' }];
    expect(g.resolveKOTeam('V M45')).toBe('Brésil');
  });

  it('"Vainq. M45" → vainqueur (alias long)', () => {
    g.allMatches = [{ id: 'M45', isFT: true, score: '3 – 1', t1: 'Espagne', t2: 'Argentine' }];
    expect(g.resolveKOTeam('Vainq. M45')).toBe('Espagne');
  });

  it('"Perdant M45" → perdant du match', () => {
    g.allMatches = [{ id: 'M45', isFT: true, score: '2 – 0', t1: 'France', t2: 'Brésil' }];
    expect(g.resolveKOTeam('Perdant M45')).toBe('Brésil');
  });

  it('match nul FT → null (prolongations à venir)', () => {
    g.allMatches = [{ id: 'M45', isFT: true, score: '1 – 1', t1: 'France', t2: 'Brésil' }];
    expect(g.resolveKOTeam('V M45')).toBeNull();
  });

  it('match non terminé → null', () => {
    g.allMatches = [{ id: 'M45', isFT: false, score: null, t1: 'France', t2: 'Brésil' }];
    expect(g.resolveKOTeam('V M45')).toBeNull();
  });

  it('chaîne vide → null', () => {
    expect(g.resolveKOTeam('')).toBeNull();
  });

  it('null → null', () => {
    expect(g.resolveKOTeam(null)).toBeNull();
  });

  it('format inconnu → null', () => {
    expect(g.resolveKOTeam('Inconnu xyz')).toBeNull();
  });
});

// ── buildThirdAssign ──────────────────────────────────────────────────────────

describe('buildThirdAssign', () => {
  /** Construit un standings complet pour un groupe donné */
  function mkFullGroup(letter, t3name, pts3) {
    return [
      { pos: 1, team: letter + '1', pts: pts3 + 6, gd: 5, gf: 6, played: 3 },
      { pos: 2, team: letter + '2', pts: pts3 + 3, gd: 2, gf: 4, played: 3 },
      { pos: 3, team: t3name,       pts: pts3,      gd: 0, gf: 2, played: 3 },
      { pos: 4, team: letter + '4', pts: 0,         gd: -5, gf: 0, played: 3 },
    ];
  }

  it('assigne la 3e place d\'un groupe à un slot compatible', () => {
    g.standings = { A: mkFullGroup('A', 'TeamA3', 4) };
    g.allMatches = [{ ko: true, id: 'M73', phase: '32es', t1: '3e A/B', t2: '1er Gr.X' }];
    const m = g.buildThirdAssign();
    expect(m.get('3e A/B')).toBe('TeamA3');
  });

  it('n\'assigne pas si le groupe qualifié n\'est pas dans la liste du slot', () => {
    g.standings = { C: mkFullGroup('C', 'TeamC3', 3) };
    g.allMatches = [{ ko: true, id: 'M73', phase: '32es', t1: '3e A/B', t2: '1er Gr.X' }];
    const m = g.buildThirdAssign();
    // Slot A/B : seuls A et B acceptés — C ne peut pas y aller
    expect(m.has('3e A/B')).toBe(false);
  });

  it('matching bipartite : résout un conflit que le greedy simple échouerait', () => {
    // B (4pts) est mieux classé que A (3pts)
    // Slot "3e A/B" traité en premier → greedy prend B
    // Slot "3e B/C" : C n'existe pas dans standings, seul B peut remplir
    //   → l'algo doit libérer B du 1er slot et mettre A à sa place
    g.standings = {
      A: mkFullGroup('A', 'TeamA3', 3),
      B: mkFullGroup('B', 'TeamB3', 4), // B mieux classé
    };
    g.allMatches = [
      { ko: true, id: 'M73', phase: '32es', t1: '3e A/B', t2: 'X' },
      { ko: true, id: 'M74', phase: '32es', t1: '3e B/C', t2: 'Y' }, // C inexistant
    ];
    const m = g.buildThirdAssign();
    // Les deux slots doivent être remplis
    expect(m.has('3e A/B')).toBe(true);
    expect(m.has('3e B/C')).toBe(true);
    // Les équipes assignées doivent être distinctes
    expect(m.get('3e A/B')).not.toBe(m.get('3e B/C'));
    // B (mieux classé) va dans le slot qui en a besoin en exclusivité → 3e B/C
    expect(m.get('3e B/C')).toBe('TeamB3');
    expect(m.get('3e A/B')).toBe('TeamA3');
  });

  it('inclut le coTeam dans la valeur Map quand ex æquo (affichage bracket)', () => {
    // Groupe C : Maroc (pos=3) et Brésil (pos=2) à égalité parfaite
    g.standings = {
      C: [
        { pos: 1, team: 'Écosse', pts: 3, gd:  1, gf: 1, played: 1 },
        { pos: 2, team: 'Brésil', pts: 1, gd:  0, gf: 1, played: 1 },
        { pos: 3, team: 'Maroc',  pts: 1, gd:  0, gf: 1, played: 1 },
        { pos: 4, team: 'Haïti',  pts: 0, gd: -1, gf: 0, played: 1 },
      ],
    };
    g.allMatches = [{ ko: true, id: 'M73', phase: '32es', t1: '3e A/C', t2: 'X' }];
    const m = g.buildThirdAssign();
    // Le slot doit afficher les deux équipes ex æquo
    expect(m.get('3e A/C')).toBe('Maroc / Brésil');
  });

  it('retourne Map vide si standings vide', () => {
    g.standings = {};
    g.allMatches = [{ ko: true, id: 'M73', phase: '32es', t1: '3e A/B', t2: 'X' }];
    expect(g.buildThirdAssign().size).toBe(0);
  });

  it('retourne Map vide si aucun match KO avec placeholder 3e', () => {
    g.standings = { A: mkFullGroup('A', 'TeamA3', 4) };
    g.allMatches = [{ ko: true, id: 'M73', phase: '32es', t1: '1er Gr.A', t2: '2e Gr.B' }];
    expect(g.buildThirdAssign().size).toBe(0);
  });

  it('ne duplique pas les slots (même pattern dans t1 et t2)', () => {
    g.standings = { A: mkFullGroup('A', 'TeamA3', 4) };
    g.allMatches = [
      { ko: true, id: 'M73', phase: '32es', t1: '3e A/B', t2: '3e A/B' }, // doublon intentionnel
    ];
    const m = g.buildThirdAssign();
    // Un seul slot "3e A/B" doit exister
    expect(m.size).toBe(1);
  });
});
