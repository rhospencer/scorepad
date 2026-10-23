import { describe, expect, it } from 'vitest';
import { farkle } from './farkle';
import { getGame } from './index';
import { finalRound, isFinished, sitsOut, winners } from '../lib/scoring';
import { createSession, draftFor, recordRound, setEntry, standings } from '../lib/session';

describe('Farkle module', () => {
  it('is in the library', () => {
    expect(getGame('farkle')).toBe(farkle);
  });

  it('plays to 10,000 with a Farkle button worth 0', () => {
    expect(farkle.winner).toEqual({ rule: 'first-to-target', target: 10000 });
    expect(farkle.roundGrid?.quickScore).toEqual({ label: 'Farkle', score: 0 });
    expect(farkle.rounds).toBeUndefined();
  });
});

describe('target-score games', () => {
  it('keeps going until someone reaches the target', () => {
    expect(isFinished(farkle, [])).toBe(false);
    expect(isFinished(farkle, [[5000, 9000], [4950, 0]])).toBe(false);
    // Seat 0 got there; seat 1 already took their last turn that round.
    expect(isFinished(farkle, [[5000, 9000], [5000, 0]])).toBe(true);
  });

  it('gives the win to the highest total once someone passes the target', () => {
    expect(winners(farkle.winner, [10050, 10400, 3000])).toEqual([1]);
    expect(winners(farkle.winner, [9000, 9500])).toEqual([]);
  });

  it('lets several players Farkle in the same round', () => {
    let s = createSession(farkle, ['Ana', 'Ben', 'Cy']);
    let d = draftFor(s, 0);
    d = setEntry(d, 0, 0);
    d = setEntry(d, 1, 0);
    d = setEntry(d, 2, 350);
    s = recordRound(farkle, s, 0, d);
    expect(s.scores[0]).toEqual([0, 0, 350]);
    expect(s.finishedAt).toBeUndefined();
  });

  it('finishes the session on the round someone crosses 10,000', () => {
    let s = createSession(farkle, ['Ana', 'Ben']);
    s = recordRound(farkle, s, 0, { entries: [9800, 6000], out: null }, 1);
    expect(s.finishedAt).toBeUndefined();
    s = recordRound(farkle, s, 1, { entries: [300, 0], out: null }, 2);
    expect(s.finishedAt).toBe(2);
    expect(standings(farkle, s).map((r) => r.player.name)).toEqual(['Ana', 'Ben']);
  });
});

describe('final turns', () => {
  // Three players. Ben (seat 1) reaches 10,000 in round 2.
  const twoRounds = [
    [4000, 9500, 3000],
    [1000, 600, 2000],
  ];

  it('gives an extra round to players seated before the one who reached the target', () => {
    expect(finalRound(farkle, twoRounds)).toEqual({ round: 2, reachedBy: 1 });
    expect(isFinished(farkle, twoRounds)).toBe(false);
  });

  it('sits out the player who reached it and everyone after them', () => {
    expect([0, 1, 2].map((p) => sitsOut(farkle, twoRounds, 2, p))).toEqual([false, true, true]);
    expect(sitsOut(farkle, twoRounds, 1, 2)).toBe(false);
  });

  it('only needs scores from players with a turn, then ends the game', () => {
    let s = createSession(farkle, ['Ana', 'Ben', 'Cy']);
    s = recordRound(farkle, s, 0, { entries: twoRounds[0], out: null });
    s = recordRound(farkle, s, 1, { entries: twoRounds[1], out: null });
    expect(s.finishedAt).toBeUndefined();
    s = recordRound(farkle, s, 2, { entries: [5500, null, null], out: null }, 7);
    expect(s.scores[2]).toEqual([5500, 0, 0]);
    expect(s.finishedAt).toBe(7);
    // Ana's last turn took her past Ben.
    expect(standings(farkle, s)[0].player.name).toBe('Ana');
  });

  it('still needs a score from players who have a last turn', () => {
    let s = createSession(farkle, ['Ana', 'Ben', 'Cy']);
    s = recordRound(farkle, s, 0, { entries: twoRounds[0], out: null });
    s = recordRound(farkle, s, 1, { entries: twoRounds[1], out: null });
    expect(() => recordRound(farkle, s, 2, { entries: [null, null, null], out: null })).toThrow();
  });

  it('counts a target reached by an earlier seat first in the same round', () => {
    // Ana and Cy both pass 10,000 in round 1; Ana plays first, so no extra round.
    expect(finalRound(farkle, [[10000, 0, 10500]])).toBeNull();
    expect(isFinished(farkle, [[10000, 0, 10500]])).toBe(true);
  });
});
