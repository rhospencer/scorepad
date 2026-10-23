import { describe, expect, it } from 'vitest';
import { kombio } from './kombio';
import { getGame, getSessionGame } from './index';
import { isFinished, winners } from '../lib/scoring';
import { approveSubmission, configuredGame, createSession, emptyDraft, recordRound, setEntry, toggleOut } from '../lib/session';
import { buildLiveRound } from '../lib/liveRound';

const adjust = kombio.roundGrid!.adjust!;

describe('Kombio caller rule', () => {
  it('gives everyone else +10 when the caller is strictly lowest', () => {
    expect(adjust([3, 12, 20], 0)).toEqual([3, 22, 30]);
  });

  it('gives the caller +15 when anyone ties or beats them', () => {
    expect(adjust([8, 8, 20], 0)).toEqual([23, 8, 20]);
    expect(adjust([8, 5, 20], 0)).toEqual([23, 5, 20]);
  });

  it('leaves scores alone when nobody called', () => {
    expect(adjust([3, 12], null)).toEqual([3, 12]);
  });

  it('works with negative special hands', () => {
    // Caller holds two 14s (−15) and is lowest.
    expect(adjust([-15, 4, 9], 0)).toEqual([-15, 14, 19]);
  });
});

describe('Kombio game length', () => {
  it('defaults to ending when someone hits 100, lowest wins', () => {
    const g = configuredGame(kombio);
    expect(g.rounds).toBeUndefined();
    expect(g.winner).toEqual({ rule: 'lowest-total', endAt: 100 });
    expect(isFinished(g, [[40, 99]])).toBe(false);
    expect(isFinished(g, [[40, 99], [5, 2]])).toBe(true);
    expect(winners(g.winner, [45, 101])).toEqual([0]);
  });

  it('can be a fixed 5 or 10 rounds instead', () => {
    expect(configuredGame(kombio, { length: '5' }).rounds).toHaveLength(5);
    expect(configuredGame(kombio, { length: '10' }).rounds).toHaveLength(10);
    const g = configuredGame(kombio, { length: '5' });
    expect(isFinished(g, [[200, 300]])).toBe(false);
  });

  it('applies the session’s choice wherever the game is looked up', () => {
    const s = createSession(kombio, ['Ana', 'Ben'], { length: '10', rotateDealer: true });
    expect(getGame('kombio')).toBe(kombio);
    expect(getSessionGame(s)?.rounds).toHaveLength(10);
  });
});

describe('Kombio rounds', () => {
  it('marks the caller without changing their typed hand, and keeps the mark while typing', () => {
    let d = emptyDraft(3);
    d = setEntry(d, 0, 4);
    d = toggleOut(kombio, d, 0);
    expect(d).toMatchObject({ entries: [4, null, null], out: 0 });
    d = setEntry(d, 0, 6, true);
    expect(d.out).toBe(0);
  });

  it('applies the caller rule when the round is saved', () => {
    let s = createSession(kombio, ['Ana', 'Ben', 'Cy']);
    s = recordRound(kombio, s, 0, { entries: [3, 12, 20], out: 0 });
    expect(s.scores[0]).toEqual([3, 22, 30]);
    expect(s.outs[0]).toBe(0);
  });

  it('approves a phone that called KOMBIO with its hand total', () => {
    const d = approveSubmission(kombio, emptyDraft(2), 1, { value: 7, special: true });
    expect(d).toMatchObject({ entries: [null, 7], out: 1 });
  });

  it('tells phones the KOMBIO button only marks the caller, and that negatives are OK', () => {
    const live = buildLiveRound(kombio, createSession(kombio, ['Ana', 'Ben']))!;
    expect(live.special).toMatchObject({ label: 'I called KOMBIO', score: null, exclusive: true });
    expect(live.allowNegative).toBe(true);
  });
});
