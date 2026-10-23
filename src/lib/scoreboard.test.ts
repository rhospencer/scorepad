import { describe, expect, it } from 'vitest';
import { farkle } from '../games/farkle';
import { fiveCrowns } from '../games/fiveCrowns';
import { buildScoreboard, ruleText } from './scoreboard';
import { createSession, recordRound, rematch } from './session';

const players = [{ name: 'Ana', emoji: '🦊', lobbyId: 'p1' }, { name: 'Ben' }, { name: 'Cy', emoji: '🐸', lobbyId: 'p3' }];

describe('live scoreboard', () => {
  it('lists everyone at zero before the first round', () => {
    const board = buildScoreboard(farkle, createSession(farkle, players));
    expect(board.status).toBe('Round 1 under way');
    expect(board.finished).toBe(false);
    expect(board.rows.map((r) => [r.name, r.total, r.rank, r.last])).toEqual([
      ['Ana', 0, 1, null],
      ['Ben', 0, 1, null],
      ['Cy', 0, 1, null],
    ]);
  });

  it('orders by standing and links phone players by lobby id', () => {
    let s = createSession(fiveCrowns, players);
    s = recordRound(fiveCrowns, s, 0, { entries: [12, 0, 30], out: 1 });
    const board = buildScoreboard(fiveCrowns, s);
    expect(board.status).toBe('After round 1 of 11');
    expect(board.rule).toBe('Lowest score wins');
    expect(board.rows).toEqual([
      { lobbyId: null, name: 'Ben', seat: 1, total: 0, rank: 1, behind: 0, last: 0 },
      { lobbyId: 'p1', name: 'Ana', emoji: '🦊', seat: 0, total: 12, rank: 2, behind: 12, last: 12 },
      { lobbyId: 'p3', name: 'Cy', emoji: '🐸', seat: 2, total: 30, rank: 3, behind: 30, last: 30 },
    ]);
  });

  it('announces final turns and leaves out turns that did not happen', () => {
    let s = createSession(farkle, players);
    s = recordRound(farkle, s, 0, { entries: [4000, 10000, 3000], out: null });
    expect(buildScoreboard(farkle, s).status).toBe('Final turns · Ben reached the target');
    s = recordRound(farkle, s, 1, { entries: [7000, null, null], out: null });
    const board = buildScoreboard(farkle, s);
    expect(board.finished).toBe(true);
    expect(board.status).toBe('Final scores');
    expect(board.winners).toEqual(['Ana']);
    expect(board.rows.map((r) => [r.name, r.last])).toEqual([
      ['Ana', 7000],
      ['Ben', null],
      ['Cy', null],
    ]);
  });

  it('keeps the lobby and phone links on a rematch, with a new game id', () => {
    const s = { ...createSession(farkle, players), lobby: { code: 'ABCD', hostKey: 'k' } };
    const again = rematch(s);
    expect(again.lobby).toEqual({ code: 'ABCD', hostKey: 'k' });
    expect(again.players.map((p) => p.lobbyId)).toEqual(['p1', undefined, 'p3']);
    expect(buildScoreboard(farkle, again).gameId).not.toBe(buildScoreboard(farkle, s).gameId);
  });

  it('describes target games', () => {
    expect(ruleText(farkle)).toBe('Played to 10,000 · highest score wins');
  });
});
