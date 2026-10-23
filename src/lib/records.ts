import { canonicalId } from './people';
import { sessionWinners, standings } from './session';
import type { GameModule, Person, Session } from './types';

/** One player's results in one game type. */
export interface GameRecord {
  gameId: string;
  name: string;
  icon: string;
  played: number;
  wins: number;
  /** Their best final total: lowest for lowest-wins games, else highest. */
  best: number;
  lowWins: boolean;
}

/** How a player did against one other player, in finished games they both played. */
export interface Rival {
  key: string;
  name: string;
  /** Finished games they both played. */
  played: number;
  /** Games where this player finished higher. */
  ahead: number;
  /** Games where the rival finished higher. Ties count for neither. */
  behind: number;
}

export interface PlayerRecord {
  /** Their lasting player id (after merges). Players without one are matched by name: "name:maya". */
  key: string;
  /** As saved, else as written in their most recent game. */
  name: string;
  emoji?: string;
  /** Their seat in their most recent game, for the avatar color. */
  seat: number;
  games: number;
  /** A tie for first counts as a win. */
  wins: number;
  /** Wins in a row, up to their latest game. */
  streak: number;
  bestStreak: number;
  firstPlayed: number;
  lastWin: number | null;
  byGame: GameRecord[];
  rivals: Rival[];
  /** Saved players merged into this one, which can be split off again. */
  mergedFrom: { id: string; name: string }[];
}

/** Who a player is across games: their lasting id (following merges), else their name. */
export function recordKey(player: { name: string; personId?: string }, byId: Map<string, Person>): string {
  return player.personId ? canonicalId(player.personId, byId) : `name:${player.name.trim().toLocaleLowerCase()}`;
}

/**
 * Records for everyone in these finished games, most wins first. `gameFor` gives a
 * session's game (with its options applied); sessions without one are skipped.
 * `people` are the saved players: their merges, names and emoji.
 */
export function playerRecords(
  sessions: Session[],
  gameFor: (s: Session) => GameModule | undefined,
  people: Person[] = [],
): PlayerRecord[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const finished = sessions.filter((s) => s.finishedAt).sort((a, b) => a.finishedAt! - b.finishedAt!);
  const records = new Map<string, PlayerRecord>();
  const rivals = new Map<string, Map<string, Rival>>();

  for (const s of finished) {
    const game = gameFor(s);
    if (!game) continue;
    const winners = new Set(sessionWinners(game, s));
    const table = standings(game, s);
    const lowWins = game.winner.rule === 'lowest-total';
    // Someone listed twice in one game counts once, at their first seat.
    const seats = new Map<string, number>();
    s.players.forEach((p, i) => {
      const key = recordKey(p, byId);
      if (!seats.has(key)) seats.set(key, i);
    });

    for (const [key, i] of seats) {
      const p = s.players[i];
      const row = table.find((r) => r.index === i)!;
      const won = winners.has(i);
      const rec = records.get(key) ?? {
        key,
        name: p.name,
        seat: i,
        games: 0,
        wins: 0,
        streak: 0,
        bestStreak: 0,
        firstPlayed: s.finishedAt!,
        lastWin: null,
        byGame: [],
        rivals: [],
        mergedFrom: [],
      };
      rec.name = p.name.trim();
      rec.emoji = p.emoji;
      rec.seat = i;
      rec.games++;
      if (won) {
        rec.wins++;
        rec.streak++;
        rec.bestStreak = Math.max(rec.bestStreak, rec.streak);
        rec.lastWin = s.finishedAt!;
      } else {
        rec.streak = 0;
      }

      let g = rec.byGame.find((x) => x.gameId === s.gameId);
      if (!g) {
        g = { gameId: s.gameId, name: game.name, icon: game.icon, played: 0, wins: 0, best: row.total, lowWins };
        rec.byGame.push(g);
      }
      g.played++;
      if (won) g.wins++;
      g.best = lowWins ? Math.min(g.best, row.total) : Math.max(g.best, row.total);
      records.set(key, rec);

      const mine = rivals.get(key) ?? new Map<string, Rival>();
      for (const [other, j] of seats) {
        if (other === key) continue;
        const theirRank = table.find((r) => r.index === j)!.rank;
        const r = mine.get(other) ?? { key: other, name: '', played: 0, ahead: 0, behind: 0 };
        r.played++;
        if (row.rank < theirRank) r.ahead++;
        else if (row.rank > theirRank) r.behind++;
        mine.set(other, r);
      }
      rivals.set(key, mine);
    }
  }

  for (const rec of records.values()) {
    const saved = byId.get(rec.key);
    if (saved) {
      rec.name = saved.name;
      rec.emoji = saved.emoji;
    }
    rec.mergedFrom = people
      .filter((p) => p.mergedInto && p.id !== rec.key && canonicalId(p.id, byId) === rec.key)
      .map((p) => ({ id: p.id, name: p.name }));
    rec.byGame.sort((a, b) => b.played - a.played);
    rec.rivals = [...(rivals.get(rec.key)?.values() ?? [])]
      .map((r) => ({ ...r, name: records.get(r.key)!.name }))
      .sort((a, b) => b.played - a.played);
  }
  return [...records.values()].sort((a, b) => b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name));
}
