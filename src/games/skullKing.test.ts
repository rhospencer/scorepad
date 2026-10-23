import { describe, expect, it } from 'vitest';
import { skullKing } from './skullKing';
import { getGame } from './index';
import { createSession } from '../lib/session';
import { totals, winners } from '../lib/scoring';
import {
  allBidsIn,
  allTricksIn,
  approveTrickSubmission,
  bonusPoints,
  changeCapture,
  emptyTricks,
  pendingTrickSubmissions,
  recordTrickRound,
  sendTrickBack,
  setTrickField,
  trickDraftFor,
  trickScore,
  tricksTaken,
} from '../lib/tricks';
import { buildLiveRound } from '../lib/liveRound';
import type { Submission } from '../lib/lobbyTypes';
import type { RoundDraft, TrickEntry } from '../lib/types';

const e = (bid: number, tricks: number, captures: Record<string, number> = {}): TrickEntry => ({ bid, tricks, captures });

describe('Skull King module', () => {
  it('is in the library with 10 rounds of 1 to 10 cards', () => {
    expect(getGame('skull-king')).toBe(skullKing);
    expect(skullKing.rounds).toHaveLength(10);
    expect(skullKing.rounds![0].label).toBe('1 card');
    expect(skullKing.rounds![9].label).toBe('10 cards');
    expect(skullKing.bidTricks!.cards(9)).toBe(10);
  });
});

describe('Skull King scoring', () => {
  it('pays 20 per trick for a made bid, plus bonuses', () => {
    expect(trickScore(skullKing, e(3, 3), 4)).toBe(60);
    expect(trickScore(skullKing, e(2, 2, { pirateBySkullKing: 1, fourteen: 2 }), 4)).toBe(40 + 30 + 20);
  });

  it('takes 10 per trick off a missed bid, with no bonuses', () => {
    expect(trickScore(skullKing, e(3, 1), 4)).toBe(-20);
    expect(trickScore(skullKing, e(1, 4, { skullKingByMermaid: 1 }), 4)).toBe(-30);
  });

  it('scores a zero bid at 10 per card dealt, either way', () => {
    // Round index 6 deals 7 cards.
    expect(trickScore(skullKing, e(0, 0), 6)).toBe(70);
    expect(trickScore(skullKing, e(0, 2), 6)).toBe(-70);
  });

  it('adds up bonus captures', () => {
    expect(bonusPoints(skullKing, { fourteen: 1, blackFourteen: 1, mermaidByPirate: 2 })).toBe(10 + 20 + 40);
  });
});

describe('bid and tricks rounds', () => {
  it('starts each round in the bid phase', () => {
    const s = createSession(skullKing, ['Ana', 'Ben']);
    const d = trickDraftFor(s, 0);
    expect(d.phase).toBe('bid');
    expect(d.tricks).toEqual(emptyTricks(2));
  });

  it('clamps bids and tricks to the cards dealt', () => {
    let t = emptyTricks(2);
    t = setTrickField(skullKing, t, 0, 'bid', 9, 2);
    t = setTrickField(skullKing, t, 1, 'tricks', -1, 2);
    expect(t[0].bid).toBe(3);
    expect(t[1].tricks).toBe(0);
  });

  it('counts captures up and down, never below zero', () => {
    let t = emptyTricks(1);
    t = changeCapture(t, 0, 'fourteen', 1);
    t = changeCapture(t, 0, 'fourteen', 1);
    t = changeCapture(t, 0, 'fourteen', -1);
    expect(t[0].captures).toEqual({ fourteen: 1 });
    t = changeCapture(changeCapture(t, 0, 'fourteen', -1), 0, 'fourteen', -1);
    expect(t[0].captures).toEqual({});
  });

  it('knows when bids and tricks are all in, and how many tricks were taken', () => {
    const t = [e(1, 1), { bid: 0, tricks: null, captures: {} }];
    expect(allBidsIn(t)).toBe(true);
    expect(allTricksIn(t)).toBe(false);
    expect(tricksTaken(t)).toBe(1);
  });

  it('records a round with scores (negatives too) and keeps the bids for the sheet', () => {
    let s = createSession(skullKing, ['Ana', 'Ben', 'Cy']);
    s = recordTrickRound(skullKing, s, 0, [e(1, 1), e(0, 0), e(1, 0)]);
    expect(s.scores[0]).toEqual([20, 10, -10]);
    expect(s.tricks?.[0][2]).toEqual(e(1, 0));
    expect(totals(s.scores, 3)).toEqual([20, 10, -10]);
    expect(winners(skullKing.winner, [20, 10, -10])).toEqual([0]);
    // A past round reopens in the play phase with what was entered.
    expect(trickDraftFor(s, 0)).toMatchObject({ phase: 'play', tricks: [e(1, 1), e(0, 0), e(1, 0)] });
  });

  it('refuses a round with a missing bid or tricks', () => {
    const s = createSession(skullKing, ['Ana', 'Ben']);
    expect(() => recordTrickRound(skullKing, s, 0, [e(1, 1), { bid: 0, tricks: null, captures: {} }])).toThrow();
  });

  it('finishes after round 10', () => {
    let s = createSession(skullKing, ['Ana', 'Ben']);
    for (let r = 0; r < 10; r++) s = recordTrickRound(skullKing, s, r, [e(0, 0), e(1, 1)], 100 + r);
    expect(s.finishedAt).toBe(109);
  });
});

describe('Skull King with phones', () => {
  const people = [{ name: 'Ana', lobbyId: 'a' }, { name: 'Ben', lobbyId: 'b' }, { name: 'Cy' }];

  it('shows phones the bid phase without anyone’s bids', () => {
    const s = createSession(skullKing, people);
    const live = buildLiveRound(skullKing, s)!;
    expect(live.trick).toMatchObject({ phase: 'bid', cards: 1, bids: null });
    expect(live.trick!.bonuses).toHaveLength(5);
    expect(live.players.map((p) => p.state)).toEqual(['open', 'open', 'open']);
  });

  it('reveals every bid once the host locks them', () => {
    let s = createSession(skullKing, people);
    let d = trickDraftFor(s, 0);
    for (const [i, bid] of [1, 0, 0].entries()) d = { ...d, tricks: setTrickField(skullKing, d.tricks!, i, 'bid', bid, 0) };
    s = { ...s, draft: { ...d, phase: 'play' } };
    const live = buildLiveRound(skullKing, s)!;
    expect(live.trick).toMatchObject({ phase: 'play', bids: [1, 0, 0] });
    expect(live.players.every((p) => p.state === 'open')).toBe(true);
  });

  it('lists pending phone bids for this phase only, then approves or sends them back', () => {
    const s = createSession(skullKing, people);
    let d = trickDraftFor(s, 0);
    const bid = (id: string, n: number, phase: 'bid' | 'play' = 'bid'): Submission => ({ gameId: s.id, round: 0, value: 0, special: false, phase, bid: n });
    const subs = { a: bid('a', 1), b: bid('b', 0, 'play') };
    const pending = pendingTrickSubmissions(s, d, subs);
    expect(pending.map((p) => p?.bid ?? null)).toEqual([1, null, null]);
    d = approveTrickSubmission(skullKing, d, 0, pending[0]!, 0);
    expect(d.tricks![0].bid).toBe(1);
    d = sendTrickBack(d, 0);
    expect(d.tricks![0].bid).toBeNull();
    expect(d.sentBack).toEqual([0]);
  });

  it('approves tricks with their bonus captures in the play phase', () => {
    const s = createSession(skullKing, people);
    let d: RoundDraft = { ...trickDraftFor(s, 0), phase: 'play' };
    const sub: Submission = { gameId: s.id, round: 0, value: 0, special: false, phase: 'play', tricks: 1, captures: { fourteen: 1 } };
    d = approveTrickSubmission(skullKing, d, 1, sub, 0);
    expect(d.tricks![1]).toMatchObject({ tricks: 1, captures: { fourteen: 1 } });
  });
});
