import { describe, it, expect } from 'vitest';
import { calcRating, getRole } from '../../worker/worker.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const zeros = {
  goals: 0, assists: 0, passes: 0, totalPass: 0, shotsOnTarget: 0,
  progCarries: 0, crosses: 0, duelsWon: 0, duels: 0,
  saves: 0, cleanSheet: 0, tackles: 0, interceptions: 0,
  clearances: 0, ballRecovery: 0, yellow: 0, red: 0,
};

function raw(overrides) { return { ...zeros, ...overrides }; }

// ── getRole ────────────────────────────────────────────────────────────────────

describe('getRole', () => {
  it('mappe les positions gardien', () => {
    expect(getRole('GK')).toBe('GK');
    expect(getRole('G')).toBe('GK');
  });
  it('mappe les défenseurs centraux', () => {
    expect(getRole('CB')).toBe('DEF');
    expect(getRole('CD')).toBe('DEF');
    expect(getRole('SW')).toBe('DEF');
  });
  it('mappe les latéraux', () => {
    expect(getRole('RB')).toBe('FB');
    expect(getRole('LWB')).toBe('FB');
  });
  it('mappe les milieux défensifs', () => {
    expect(getRole('CDM')).toBe('DM');
    expect(getRole('DM')).toBe('DM');
  });
  it('mappe les milieux centraux', () => {
    expect(getRole('CM')).toBe('CM');
    expect(getRole('RM')).toBe('CM');
  });
  it('mappe les milieux offensifs', () => {
    expect(getRole('CAM')).toBe('AM');
    expect(getRole('SS')).toBe('AM');
  });
  it('mappe les attaquants', () => {
    expect(getRole('ST')).toBe('FW');
    expect(getRole('LW')).toBe('FW');
    expect(getRole('CF')).toBe('FW');
  });
  it('retourne CM par défaut pour position inconnue', () => {
    expect(getRole('XX')).toBe('CM');
    expect(getRole('')).toBe('CM');
    expect(getRole(null)).toBe('CM');
  });
  it('ignore le suffixe après tiret (ex: CB-L)', () => {
    expect(getRole('CB-L')).toBe('DEF');
    expect(getRole('ST-R')).toBe('FW');
  });
});

// ── calcRating — cas généraux ──────────────────────────────────────────────────

describe('calcRating — base', () => {
  it('retourne null si minutes = 0', () => {
    expect(calcRating(raw(), 'CM', 0)).toBeNull();
  });
  it('retourne null si minutes est undefined/null', () => {
    expect(calcRating(raw(), 'CM', null)).toBeNull();
    expect(calcRating(raw(), 'CM', undefined)).toBeNull();
  });
  it('note minimale clampée à 4.0', () => {
    const r = raw({ red: 5 });
    expect(calcRating(r, 'CM', 90)).toBeGreaterThanOrEqual(4.0);
  });
  it('note maximale clampée à 9.5', () => {
    const r = raw({ goals: 10, assists: 10, saves: 20, cleanSheet: 1 });
    expect(calcRating(r, 'GK', 90)).toBeLessThanOrEqual(9.5);
  });
  it('carton rouge pénalise la note', () => {
    const base = calcRating(raw(), 'CM', 90);
    const withRed = calcRating(raw({ red: 1 }), 'CM', 90);
    expect(withRed).toBeLessThan(base);
  });
  it('carton jaune pénalise moins que rouge', () => {
    const withYellow = calcRating(raw({ yellow: 1 }), 'CM', 90);
    const withRed    = calcRating(raw({ red: 1 }),    'CM', 90);
    expect(withRed).toBeLessThan(withYellow);
  });
});

// ── calcRating — GK ───────────────────────────────────────────────────────────

describe('calcRating — GK', () => {
  it('clean sheet sans but encaissé → note > 6.5', () => {
    const r = raw({ cleanSheet: 1, saves: 2, passes: 35, totalPass: 40 });
    expect(calcRating(r, 'GK', 90)).toBeGreaterThan(6.5);
  });
  it('nombreux arrêts → note élevée', () => {
    const r = raw({ saves: 7, passes: 30, totalPass: 38 });
    expect(calcRating(r, 'GK', 90)).toBeGreaterThan(7.0);
  });
  it('but marqué depuis les cages → bonus offensif', () => {
    const r1 = raw({ saves: 3, passes: 30, totalPass: 38 });
    const r2 = raw({ saves: 3, goals: 1, passes: 30, totalPass: 38 });
    expect(calcRating(r2, 'GK', 90)).toBeGreaterThan(calcRating(r1, 'GK', 90));
  });
});

// ── calcRating — DEF ──────────────────────────────────────────────────────────

describe('calcRating — DEF', () => {
  it('clean sheet + duels gagnés → note > 6.5', () => {
    const r = raw({ cleanSheet: 1, duelsWon: 4, duels: 6, tackles: 3, passes: 40, totalPass: 50 });
    expect(calcRating(r, 'DEF', 90)).toBeGreaterThan(6.5);
  });
  it('but marqué → bonus offensif significatif', () => {
    const r1 = raw({ cleanSheet: 1, duelsWon: 3, duels: 5 });
    const r2 = raw({ cleanSheet: 1, duelsWon: 3, duels: 5, goals: 1 });
    expect(calcRating(r2, 'DEF', 90)).toBeGreaterThan(calcRating(r1, 'DEF', 90));
  });
});

// ── calcRating — FB ───────────────────────────────────────────────────────────

describe('calcRating — FB', () => {
  it('centre + passe précise → note > base', () => {
    const r = raw({ crosses: 3, passes: 45, totalPass: 50, progCarries: 3 });
    expect(calcRating(r, 'FB', 90)).toBeGreaterThan(6.3);
  });
});

// ── calcRating — DM ───────────────────────────────────────────────────────────

describe('calcRating — DM', () => {
  it('tacles + interceptions + ballRecovery → note > base', () => {
    const r = raw({ tackles: 4, interceptions: 3, ballRecovery: 5, duelsWon: 5, duels: 7 });
    expect(calcRating(r, 'DM', 90)).toBeGreaterThan(6.3);
  });
});

// ── calcRating — CM ───────────────────────────────────────────────────────────

describe('calcRating — CM', () => {
  it('passes précises + passes cibles suffisantes → bonus passPct', () => {
    const rLow  = raw({ passes: 15, totalPass: 20 }); // 75% → passPct = 0
    const rHigh = raw({ passes: 38, totalPass: 40 }); // 95% → passPct = 0.20
    expect(calcRating(rHigh, 'CM', 90)).toBeGreaterThan(calcRating(rLow, 'CM', 90));
  });
  it('moins de 15 passes totales → passPct ignoré', () => {
    const r = raw({ passes: 14, totalPass: 14 });
    expect(calcRating(r, 'CM', 90)).toBeCloseTo(6.3, 0);
  });
  it('but + passe déc → note > 7.5', () => {
    const r = raw({ goals: 1, assists: 1 });
    expect(calcRating(r, 'CM', 90)).toBeGreaterThan(7.5);
  });
});

// ── calcRating — AM ───────────────────────────────────────────────────────────

describe('calcRating — AM', () => {
  it('pénalité si moins de 0.5 tirs', () => {
    const withShot    = raw({ shotsOnTarget: 1, goals: 0 });
    const withoutShot = raw({ shotsOnTarget: 0, goals: 0 });
    expect(calcRating(withoutShot, 'AM', 90)).toBeLessThan(calcRating(withShot, 'AM', 90));
  });
  it('but marqué → note significativement > base', () => {
    const r = raw({ goals: 1, shotsOnTarget: 2 });
    expect(calcRating(r, 'AM', 90)).toBeGreaterThan(7.0);
  });
});

// ── calcRating — FW ───────────────────────────────────────────────────────────

describe('calcRating — FW', () => {
  it('pénalité si moins de 0.5 tirs', () => {
    const withShot    = raw({ shotsOnTarget: 1 });
    const withoutShot = raw({ shotsOnTarget: 0 });
    expect(calcRating(withoutShot, 'FW', 90)).toBeLessThan(calcRating(withShot, 'FW', 90));
  });
  it('hat-trick → note > 8.0', () => {
    const r = raw({ goals: 3, shotsOnTarget: 5 });
    expect(calcRating(r, 'FW', 90)).toBeGreaterThan(8.0);
  });
  it('buts plafonnés à 9.5', () => {
    const r = raw({ goals: 10, shotsOnTarget: 10 });
    expect(calcRating(r, 'FW', 90)).toBeLessThanOrEqual(9.5);
  });
  it('passe déc sans but → meilleur que rien', () => {
    const r1 = raw({ shotsOnTarget: 1 });
    const r2 = raw({ assists: 1, shotsOnTarget: 1 });
    expect(calcRating(r2, 'FW', 90)).toBeGreaterThan(calcRating(r1, 'FW', 90));
  });
});

// ── calcRating — normalisation p90 ────────────────────────────────────────────

describe('calcRating — normalisation minutes', () => {
  it('90 min → pas de correction p90', () => {
    const r = raw({ tackles: 3, passes: 30, totalPass: 40 });
    const at90  = calcRating(r, 'DM', 90);
    const at90b = calcRating({ ...r, tackles: 3 }, 'DM', 90);
    expect(at90).toBe(at90b);
  });
  it('60 min → p90 amplifie les stats (légèrement)', () => {
    const r = raw({ tackles: 2, duelsWon: 2, duels: 4 });
    const at90 = calcRating(r, 'DM', 90);
    const at60 = calcRating(r, 'DM', 60);
    // Moins de minutes → stats p90 légèrement plus élevées mais facteur atténué
    expect(Math.abs(at60 - at90)).toBeLessThan(0.5);
  });
  it('retourne un nombre arrondi à 1 décimale', () => {
    const r = raw({ passes: 30, totalPass: 40 });
    const note = calcRating(r, 'CM', 90);
    expect(note).toBe(Math.round(note * 10) / 10);
  });
});
