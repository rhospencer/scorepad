import { describe, expect, it } from 'vitest';
import { farkle } from '../games/farkle';
import { fiveCrowns } from '../games/fiveCrowns';
import { createSession, recordRound } from './session';
import { gameStats } from './stats';

describe('results stats', () => {
  it('Five Crowns: most times out, worst hand, closest race', () => {
    let s = createSession(fiveCrowns, ['Alex', 'Sam', 'Jordan']);
    s = recordRound(fiveCrowns, s, 0, { entries: [12, 0, 23], out: 1 });
    s = recordRound(fiveCrowns, s, 1, { entries: [0, 18, 31], out: 0 });
    s = recordRound(fiveCrowns, s, 2, { entries: [25, 0, 76], out: 1 });
    expect(gameStats(fiveCrowns, s)).toEqual([
      { label: 'Most times out', value: 'Sam · 2 times' },
      { label: 'Worst hand', value: 'Jordan · 76 in round 3' },
      { label: 'Closest race', value: 'Sam and Alex, 19 apart' },
    ]);
  });

  it('Farkle: most farkles and best turn, skipping turns nobody took', () => {
    let s = createSession(farkle, ['Ana', 'Ben', 'Cy']);
    s = recordRound(farkle, s, 0, { entries: [4000, 0, 0], out: null });
    s = recordRound(farkle, s, 1, { entries: [0, 10000, 2500], out: null });
    // Final turns: Ben reached 10,000, so only Ana plays; Ben and Cy's zeros aren't farkles.
    s = recordRound(farkle, s, 2, { entries: [1000, null, null], out: null });
    expect(gameStats(farkle, s)).toEqual([
      { label: 'Most farkles', value: 'Ana, Ben & Cy · once' },
      { label: 'Best turn', value: 'Ben · 10,000 in round 2' },
      { label: 'Closest race', value: 'Ben and Ana, 5,000 apart' },
    ]);
  });

  it('reports ties and skips stats with nothing to show', () => {
    let s = createSession(fiveCrowns, ['A', 'B']);
    s = recordRound(fiveCrowns, s, 0, { entries: [10, 10], out: null });
    expect(gameStats(fiveCrowns, s)).toEqual([
      { label: 'Worst hand', value: 'A · 10 in round 1' },
      { label: 'Closest race', value: 'A and B tied' },
    ]);
    expect(gameStats(fiveCrowns, createSession(fiveCrowns, ['A', 'B']))).toEqual([]);
  });
});
