import { describe, expect, it } from 'vitest';
import { farkle } from '../games/farkle';
import { fiveCrowns } from '../games/fiveCrowns';
import { buildLiveRound, outConflict, pendingSubmissions } from './liveRound';
import type { Submission } from './lobbyTypes';
import { approveSubmission, createSession, draftComplete, emptyDraft, recordRound, sendBack, setEntry } from './session';
import type { Session } from './types';

const people = [
  { name: 'Ana', emoji: '🦊', lobbyId: 'a' },
  { name: 'Ben', emoji: '🐼', lobbyId: 'b' },
  { name: 'Cy' },
];

function sub(s: Session, value: number, special = false, round = s.scores.length): Submission {
  return { gameId: s.id, round, value, special };
}

describe('live round for phones', () => {
  it('describes a Five Crowns round with card buttons and a one-per-round Out', () => {
    const s = createSession(fiveCrowns, people);
    const live = buildLiveRound(fiveCrowns, s)!;
    expect(live).toMatchObject({ gameId: s.id, round: 0, title: '3 cards', note: '3s are wild', dealer: 'Ana' });
    expect(live.prompt).toBe('Cards left in your hand');
    expect(live.keypad.map((k) => k.label)).toEqual(['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'Wild', 'Joker']);
    expect(live.special).toEqual({ label: 'I went out', score: 0, exclusive: true, takenBy: null });
    expect(live.players.map((p) => [p.lobbyId, p.state])).toEqual([
      ['a', 'open'],
      ['b', 'open'],
      [null, 'open'],
    ]);
  });

  it('describes a Farkle round with point shortcuts and a Farkle anyone can use', () => {
    const live = buildLiveRound(farkle, createSession(farkle, people))!;
    expect(live.note).toBe('First to 10,000');
    expect(live.keypad.map((k) => k.value)).toEqual([50, 100, 500, 1000]);
    expect(live.special).toMatchObject({ label: 'I farkled', exclusive: false });
  });

  it('marks approved, sent back, and who went out, without sharing scores', () => {
    let s = createSession(fiveCrowns, people);
    let d = approveSubmission(fiveCrowns, emptyDraft(3), 0, sub(s, 0, true));
    d = sendBack(d, 1);
    s = { ...s, draft: d };
    const live = buildLiveRound(fiveCrowns, s)!;
    expect(live.players.map((p) => p.state)).toEqual(['approved', 'sentBack', 'open']);
    expect(live.special?.takenBy).toBe('Ana');
    for (const p of live.players) expect(Object.keys(p).sort()).toEqual(['emoji', 'lobbyId', 'name', 'seat', 'state'].filter((k) => k in p));
    expect(live.players.every((p) => !('value' in p) && !('score' in p))).toBe(true);
  });

  it('is null once the game is over', () => {
    let s = createSession(farkle, people);
    s = recordRound(farkle, s, 0, { entries: [10000, 0, 0], out: null });
    expect(buildLiveRound(farkle, s)).toBeNull();
  });
});

describe('host review', () => {
  it('lists pending phone scores for this round only, for players without a score yet', () => {
    const s = createSession(fiveCrowns, people);
    const d = setEntry(emptyDraft(3), 1, 9);
    const subs = { a: sub(s, 24), b: sub(s, 11), z: sub(s, 5) };
    expect(pendingSubmissions(fiveCrowns, s, d, subs).map((p) => p?.value ?? null)).toEqual([24, null, null]);
    expect(pendingSubmissions(fiveCrowns, s, d, { a: sub(s, 24, false, 3) })[0]).toBeNull();
    expect(pendingSubmissions(fiveCrowns, s, d, { a: { ...sub(s, 24), gameId: 'old' } })[0]).toBeNull();
  });

  it('approves a score, a Farkle, and an Out', () => {
    const s = createSession(fiveCrowns, people);
    let d = approveSubmission(fiveCrowns, emptyDraft(3), 0, sub(s, 24));
    d = approveSubmission(fiveCrowns, d, 1, sub(s, 0, true));
    expect(d).toMatchObject({ entries: [24, 0, null], out: 1 });
    const f = approveSubmission(farkle, emptyDraft(3), 2, { value: 999, special: true });
    expect(f.entries).toEqual([null, null, 0]);
  });

  it('sends a score back, and clears that once the host enters one', () => {
    let d = sendBack(setEntry(emptyDraft(3), 0, 40), 0);
    expect(d).toMatchObject({ entries: [null, null, null], sentBack: [0] });
    d = setEntry(d, 0, 35);
    expect(d.sentBack).toBeUndefined();
    expect(draftComplete(d)).toBe(false);
  });

  it('flags two players who both say they went out', () => {
    const s = createSession(fiveCrowns, people);
    const pending = [sub(s, 0, true), sub(s, 0, true), null];
    expect(outConflict(fiveCrowns, s, emptyDraft(3), pending)).toEqual(['Ana', 'Ben']);
    const d = approveSubmission(fiveCrowns, emptyDraft(3), 2, { value: 0, special: true });
    expect(outConflict(fiveCrowns, s, d, [sub(s, 0, true), null, null])).toEqual(['Cy', 'Ana']);
    expect(outConflict(farkle, s, emptyDraft(3), pending)).toEqual([]);
  });
});
