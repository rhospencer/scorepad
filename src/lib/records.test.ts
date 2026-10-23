import { describe, expect, it } from 'vitest';
import { farkle } from '../games/farkle';
import { fiveCrowns } from '../games/fiveCrowns';
import { getSessionGame } from '../games';
import { playerRecords } from './records';
import { createSession } from './session';
import type { GameModule, Session } from './types';

/** A finished game with these final totals, as one round. */
function finished(game: GameModule, names: string[], totals: number[], at: number): Session {
  const s = createSession(game, names);
  return { ...s, scores: [totals], outs: [null], finishedAt: at };
}

describe('player records', () => {
  const sessions = [
    finished(fiveCrowns, ['Maya', 'Leo', 'Priya'], [20, 50, 30], 1),
    finished(fiveCrowns, ['maya ', 'Leo'], [40, 10], 2),
    finished(farkle, ['Maya', 'Priya'], [10000, 6000], 3),
    finished(farkle, ['Maya', 'Priya'], [10000, 10000], 4),
    // Unfinished games don't count.
    createSession(farkle, ['Leo', 'Priya']),
  ];
  const records = playerRecords(sessions, getSessionGame);
  const maya = records.find((r) => r.key === 'name:maya')!;

  it('without lasting ids, matches players by name, ignoring case and spaces', () => {
    expect(records.map((r) => r.name)).toEqual(['Maya', 'Priya', 'Leo']);
    expect(maya.games).toBe(4);
  });

  it('counts wins, ties for first, and streaks', () => {
    expect(maya.wins).toBe(3);
    expect(maya.streak).toBe(2);
    expect(maya.bestStreak).toBe(2);
    expect(maya.lastWin).toBe(4);
    const priya = records.find((r) => r.key === 'name:priya')!;
    expect(priya.wins).toBe(1);
  });

  it('keeps a record per game with the best total', () => {
    expect(maya.byGame).toEqual([
      { gameId: 'five-crowns', name: 'Five Crowns', icon: '👑', played: 2, wins: 1, best: 20, lowWins: true },
      { gameId: 'farkle', name: 'Farkle', icon: '🎲', played: 2, wins: 2, best: 10000, lowWins: false },
    ]);
  });

  it('counts head to head by finishing place, ties for neither', () => {
    expect(maya.rivals).toEqual([
      { key: 'name:priya', name: 'Priya', played: 3, ahead: 2, behind: 0 },
      { key: 'name:leo', name: 'Leo', played: 2, ahead: 1, behind: 1 },
    ]);
  });

  it('keeps two players with the same name apart by their ids', () => {
    const withIds = (s: Session, ids: string[]) => ({ ...s, players: s.players.map((p, i) => ({ ...p, personId: ids[i] })) });
    const games = [
      withIds(finished(fiveCrowns, ['Maya', 'Maya', 'Leo'], [10, 20, 30], 1), ['m1', 'm2', 'l']),
      withIds(finished(fiveCrowns, ['Maya', 'Leo'], [50, 40], 2), ['m2', 'l']),
    ];
    const recs = playerRecords(games, getSessionGame);
    expect(recs.map((r) => [r.key, r.name, r.games, r.wins])).toEqual([
      ['l', 'Leo', 2, 1],
      ['m1', 'Maya', 1, 1],
      ['m2', 'Maya', 2, 0],
    ]);

    // Merging m2 into m1 combines them, under the saved name.
    const people = [
      { id: 'm1', name: 'Maya B', lastPlayed: 2 },
      { id: 'm2', name: 'Maya', lastPlayed: 2, mergedInto: 'm1' },
    ];
    const merged = playerRecords(games, getSessionGame, people);
    const maya = merged.find((r) => r.key === 'm1')!;
    expect(maya.name).toBe('Maya B');
    expect(maya.games).toBe(2);
    expect(maya.mergedFrom).toEqual([{ id: 'm2', name: 'Maya' }]);
  });
});
