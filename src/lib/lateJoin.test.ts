import { describe, expect, it } from 'vitest';
import { farkle } from '../games/farkle';
import { fiveCrowns } from '../games/fiveCrowns';
import { kombio } from '../games/kombio';
import { skullKing } from '../games/skullKing';
import { addLatePlayer, cantAddReason, defaultLateStart, lateStartChoices, linkPhone, missedRound } from './lateJoin';
import { buildScoreboard } from './scoreboard';
import { totals } from './scoring';
import { configuredGame, createSession, recordRound, standings } from './session';
import { gameStats } from './stats';

function played(game = fiveCrowns, rounds: number[][] = [[10, 30], [20, 27]]) {
  let s = createSession(game, ['Ana', 'Ben']);
  rounds.forEach((entries, r) => (s = recordRound(game, s, r, { entries, out: null })));
  return s;
}

describe('late start choices', () => {
  it('match last place in lowest-wins games, and default to it', () => {
    const s = played(); // totals 30, 57
    const c = Object.fromEntries(lateStartChoices(fiveCrowns, s, 10, 40).map((x) => [x.id, x.value]));
    expect(c).toEqual({ last: 57, lastPlus: 67, average: 44, fixed: 40, none: 0 });
    expect(defaultLateStart(fiveCrowns)).toBe('last');
  });

  it('start at 0 by default when highest wins; last place is the lowest total', () => {
    const s = played(farkle, [[500, 300]]);
    expect(defaultLateStart(farkle)).toBe('none');
    expect(lateStartChoices(farkle, s).find((c) => c.id === 'last')?.value).toBe(300);
  });

  it('never start someone at the score that ends the game', () => {
    const g = configuredGame(kombio, { length: 'to100', rotateDealer: true });
    const s = played(g, [[60, 90]]);
    expect(lateStartChoices(g, s, 30).find((c) => c.id === 'lastPlus')?.value).toBe(99);
  });
});

describe('addLatePlayer', () => {
  it('adds a column: 0s for missed rounds, the starting score just before they join', () => {
    const s = addLatePlayer(fiveCrowns, played(), { name: 'Maya', emoji: '🦩' }, 57);
    expect(s.players[2]).toMatchObject({ name: 'Maya', emoji: '🦩', joinedRound: 2 });
    expect(s.scores).toEqual([
      [10, 30, 0],
      [20, 27, 57],
    ]);
    expect(totals(s.scores, 3)).toEqual([30, 57, 57]);
    expect(missedRound(s.players[2], 1)).toBe(true);
    expect(missedRound(s.players[2], 2)).toBe(false);
  });

  it('extends an unfinished round so they can score it', () => {
    const s = { ...played(), draft: { entries: [5, null], out: null } };
    expect(addLatePlayer(fiveCrowns, s, { name: 'Maya' }, 0).draft?.entries).toEqual([5, null, null]);
  });

  it('joins from round 1 with nothing missed', () => {
    const s = addLatePlayer(fiveCrowns, createSession(fiveCrowns, ['Ana', 'Ben']), { name: 'Maya' }, 99);
    expect(s.players[2].joinedRound).toBeUndefined();
    expect(s.scores).toEqual([]);
  });

  it('keeps the starting score out of stats and the phones’ last round', () => {
    const s = addLatePlayer(fiveCrowns, played(), { name: 'Maya', lobbyId: 'phone1' }, 57);
    expect(gameStats(fiveCrowns, s).find((x) => x.label === 'Worst hand')?.value).toMatch(/Ben · 30/);
    const row = buildScoreboard(fiveCrowns, s).rows.find((r) => r.lobbyId === 'phone1');
    expect(row).toMatchObject({ total: 57, last: null });
    expect(standings(fiveCrowns, s).map((x) => x.player.name)).toEqual(['Ana', 'Ben', 'Maya']);
  });

  it('adds bids-and-tricks entries for Skull King', () => {
    let s = createSession(skullKing, ['Ana', 'Ben']);
    s = { ...s, tricks: [[{ bid: 1, tricks: 1, captures: {} }, { bid: 0, tricks: 0, captures: {} }]], scores: [[20, 10]], outs: [null] };
    const next = addLatePlayer(skullKing, s, { name: 'Maya' }, 0);
    expect(next.tricks?.[0]).toHaveLength(3);
  });
});

describe('when players can be added', () => {
  it('not during final turns, once bids are locked, or after the game', () => {
    const f = played(farkle, [[200, 10_000]]); // Ben reached it: final turns
    expect(cantAddReason(farkle, f)).toMatch(/final turns/);
    const sk = { ...createSession(skullKing, ['Ana', 'Ben']), draft: { entries: [null, null], out: null, phase: 'play' as const } };
    expect(cantAddReason(skullKing, sk)).toMatch(/Bids are locked/);
    expect(cantAddReason(fiveCrowns, { ...played(), finishedAt: 1 })).toBeNull(); // rounds left: not over
    expect(cantAddReason(fiveCrowns, played())).toBeNull();
  });
});

describe('linkPhone', () => {
  it('links a typed-in player’s phone, keeping their name and scores', () => {
    const s = linkPhone(played(), 1, { lobbyId: 'p9', emoji: '🐼', personId: 'person-123456' });
    expect(s.players[1]).toMatchObject({ name: 'Ben', lobbyId: 'p9', emoji: '🐼', personId: 'person-123456' });
    expect(s.scores).toEqual(played().scores);
  });

  it('moves a player to a new phone', () => {
    const s = linkPhone(linkPhone(played(), 0, { lobbyId: 'old' }), 0, { lobbyId: 'new' });
    expect(s.players[0].lobbyId).toBe('new');
  });
});
