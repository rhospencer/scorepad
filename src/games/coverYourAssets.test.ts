import { describe, expect, it } from 'vitest';
import { coverYourAssets } from './coverYourAssets';
import { getGame } from './index';
import { finalRound, isFinished, winners } from '../lib/scoring';
import { createSession, recordRound } from '../lib/session';
import { buildLiveRound } from '../lib/liveRound';
import { gameStats } from '../lib/stats';

describe('Cover Your Assets', () => {
  it('is in the library, played to $1,000,000 with 7-digit entries', () => {
    expect(getGame('cover-your-assets')).toBe(coverYourAssets);
    expect(coverYourAssets.winner).toEqual({ rule: 'first-to-target', target: 1_000_000 });
    expect(coverYourAssets.roundGrid?.entryDigits).toBe(7);
  });

  it('keeps going until a round ends with someone past a million', () => {
    expect(isFinished(coverYourAssets, [[450_000, 380_000]])).toBe(false);
    expect(isFinished(coverYourAssets, [[450_000, 380_000], [400_000, 640_000]])).toBe(true);
  });

  it('ends right after that round: no final turns, unlike Farkle', () => {
    expect(finalRound(coverYourAssets, [[450_000, 1_200_000]])).toBeNull();
    expect(isFinished(coverYourAssets, [[450_000, 1_200_000]])).toBe(true);
  });

  it('gives the win to the highest total once someone is past a million', () => {
    expect(winners(coverYourAssets.winner, [1_050_000, 1_020_000, 600_000])).toEqual([0]);
  });

  it('finishes the session and tells phones there is no round left', () => {
    let s = createSession(coverYourAssets, ['Ana', 'Ben']);
    s = recordRound(coverYourAssets, s, 0, { entries: [550_000, 420_000], out: null }, 1);
    expect(buildLiveRound(coverYourAssets, s)?.maxDigits).toBe(7);
    s = recordRound(coverYourAssets, s, 1, { entries: [500_000, 700_000], out: null }, 2);
    expect(s.finishedAt).toBe(2);
    expect(buildLiveRound(coverYourAssets, s)).toBeNull();
    expect(gameStats(coverYourAssets, s).map((x) => x.label)).toEqual(['Best round', 'Closest race']);
  });
});
