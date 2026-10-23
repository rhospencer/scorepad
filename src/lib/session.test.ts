import { describe, expect, it } from 'vitest';
import { fiveCrowns } from '../games/fiveCrowns';
import {
  cheatSheetText,
  createSession,
  MAX_PLAYERS,
  dealerIndex,
  defaultOptions,
  draftComplete,
  draftFor,
  emptyDraft,
  recordRound,
  rematch,
  setEntry,
  standings,
  toggleOut,
} from './session';
import type { RoundDraft, Session } from './types';

describe('player setup', () => {
  it('uses the module defaults for options', () => {
    expect(defaultOptions(fiveCrowns)).toEqual({ rotateDealer: true, cheatSheet: true });
  });

  it('creates an empty session with named players', () => {
    const s = createSession(fiveCrowns, ['Ana', ' Ben '], undefined, 1000);
    expect(s.gameId).toBe('five-crowns');
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
    expect(s.scores).toEqual([]);
    expect(s.outs).toEqual([]);
    expect(s.startedAt).toBe(1000);
    expect(s.finishedAt).toBeUndefined();
    expect(new Set(s.players.map((p) => p.id)).size).toBe(2);
  });

  it('names blank players by seat', () => {
    const s = createSession(fiveCrowns, ['Ana', '', '  ']);
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Player 2', 'Player 3']);
  });

  it('enforces the 2–7 player range', () => {
    expect(() => createSession(fiveCrowns, ['Solo'])).toThrow();
    // The game's max is a suggestion: bigger tables are fine up to the app-wide cap.
    expect(() => createSession(fiveCrowns, new Array(8).fill('x'))).not.toThrow();
    expect(() => createSession(fiveCrowns, new Array(MAX_PLAYERS).fill('x'))).not.toThrow();
    expect(() => createSession(fiveCrowns, new Array(MAX_PLAYERS + 1).fill('x'))).toThrow();
  });

  it('turns the dealer and cheat sheet off through options', () => {
    const on = createSession(fiveCrowns, ['A', 'B', 'C']);
    expect(dealerIndex(fiveCrowns, on, 4)).toBe(1);
    expect(cheatSheetText(fiveCrowns, on)).toContain('Joker 50');

    const off = createSession(fiveCrowns, ['A', 'B'], { rotateDealer: false, cheatSheet: false });
    expect(dealerIndex(fiveCrowns, off, 0)).toBeNull();
    expect(cheatSheetText(fiveCrowns, off)).toBeNull();
  });

  it('rematch keeps players and options but starts fresh', () => {
    const s = { ...createSession(fiveCrowns, ['A', 'B'], { rotateDealer: false, cheatSheet: true }), scores: [[1, 2]], outs: [null], finishedAt: 5 };
    const r = rematch(s, 9);
    expect(r.id).not.toBe(s.id);
    expect(r.players).toEqual(s.players);
    expect(r.options).toEqual(s.options);
    expect(r.scores).toEqual([]);
    expect(r.finishedAt).toBeUndefined();
    expect(r.startedAt).toBe(9);
  });
});

describe('round entry', () => {
  it('marks one player out at a time and gives them the out score', () => {
    let d = emptyDraft(3);
    d = toggleOut(fiveCrowns, d, 1);
    expect(d).toEqual({ entries: [null, 0, null], out: 1 });
    d = toggleOut(fiveCrowns, d, 2);
    expect(d).toEqual({ entries: [null, null, 0], out: 2 });
    d = toggleOut(fiveCrowns, d, 2);
    expect(d).toEqual({ entries: [null, null, null], out: null });
  });

  it('typing a score for the out player unmarks them', () => {
    const d = setEntry(toggleOut(fiveCrowns, emptyDraft(2), 0), 0, 12);
    expect(d).toEqual({ entries: [12, null], out: null });
  });

  it('is complete once every player has a score', () => {
    expect(draftComplete({ entries: [0, null], out: 0 })).toBe(false);
    expect(draftComplete({ entries: [0, 14], out: 0 })).toBe(true);
  });
});

describe('recording rounds', () => {
  const play = (s: Session, entries: number[], out: number | null = null) =>
    recordRound(fiveCrowns, s, s.scores.length, { entries, out }, 42);

  it('appends rounds and clears the draft', () => {
    let s = createSession(fiveCrowns, ['A', 'B']);
    s = { ...s, draft: { entries: [3, null], out: null } };
    expect(draftFor(s, 0)).toEqual({ entries: [3, null], out: null });
    s = play(s, [0, 14], 0);
    expect(s.scores).toEqual([[0, 14]]);
    expect(s.outs).toEqual([0]);
    expect(s.draft).toBeUndefined();
    expect(draftFor(s, 1)).toEqual(emptyDraft(2));
  });

  it('rejects incomplete rounds and skipping ahead', () => {
    const s = createSession(fiveCrowns, ['A', 'B']);
    expect(() => recordRound(fiveCrowns, s, 0, { entries: [1, null], out: null })).toThrow();
    expect(() => recordRound(fiveCrowns, s, 1, { entries: [1, 2], out: null })).toThrow();
  });

  it('fixes a past round without touching the draft for the next one', () => {
    let s = play(play(createSession(fiveCrowns, ['A', 'B']), [0, 10], 0), [5, 0], 1);
    const draft: RoundDraft = { entries: [7, null], out: null };
    s = { ...s, draft };
    expect(draftFor(s, 0)).toEqual({ entries: [0, 10], out: 0 });
    s = recordRound(fiveCrowns, s, 0, { entries: [0, 12], out: 0 });
    expect(s.scores).toEqual([
      [0, 12],
      [5, 0],
    ]);
    expect(s.draft).toEqual(draft);
  });

  it('finishes after round 11', () => {
    let s = createSession(fiveCrowns, ['A', 'B']);
    for (let r = 0; r < 10; r++) s = play(s, [r, 2], null);
    expect(s.finishedAt).toBeUndefined();
    s = play(s, [0, 30], 0);
    expect(s.finishedAt).toBe(42);
    expect(s.scores).toHaveLength(11);
  });
});

describe('standings', () => {
  it('orders lowest first with shared ranks and gaps to the leader', () => {
    const s: Session = {
      ...createSession(fiveCrowns, ['A', 'B', 'C', 'D']),
      scores: [
        [10, 5, 5, 20],
        [0, 5, 5, 0],
      ],
    };
    expect(standings(fiveCrowns, s).map((x) => [x.player.name, x.total, x.rank, x.behind])).toEqual([
      ['A', 10, 1, 0],
      ['B', 10, 1, 0],
      ['C', 10, 1, 0],
      ['D', 20, 4, 10],
    ]);
  });
});
