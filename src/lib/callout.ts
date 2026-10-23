import { isFinished } from './scoring';
import { ordinal } from './scoreboard';
import { standings } from './session';
import type { Callout } from './lobbyTypes';
import type { GameModule, Session } from './types';

/**
 * A moment worth calling out after the latest round: a new leader, a tie at the top,
 * or a big climb. Null when nothing much changed, before round 2, or once the game is
 * over (the results screen celebrates that).
 */
export function roundCallout(game: GameModule, session: Session): Callout | null {
  const scored = session.scores.length;
  if (scored < 2 || session.players.length < 2 || isFinished(game, session.scores)) return null;

  const before = rankBySeat(game, { ...session, scores: session.scores.slice(0, -1) });
  const after = rankBySeat(game, session);
  const name = (seat: number) => session.players[seat].name;
  const id = `${session.id}:${scored}`;

  const leadersBefore = seatsAt(before, 1);
  const leadersNow = seatsAt(after, 1);

  if (leadersNow.length === 1 && !leadersBefore.includes(leadersNow[0])) {
    const seat = leadersNow[0];
    return { id, kind: 'lead', seat, text: `${name(seat)} takes the lead!` };
  }
  if (leadersNow.length > 1 && leadersBefore.length === 1) {
    const names = leadersNow.map(name);
    const list = names.length === 2 ? names.join(' and ') : `${names.length} players`;
    return { id, kind: 'tie', seat: leadersNow[0], text: `${list} are tied for the lead` };
  }

  // A comeback: the biggest climb of at least two places (three players or more).
  if (session.players.length >= 3) {
    let climber = -1;
    for (let seat = 0; seat < after.length; seat++) {
      const gain = before[seat] - after[seat];
      if (gain >= 2 && (climber < 0 || gain > before[climber] - after[climber])) climber = seat;
    }
    if (climber >= 0) {
      const seat = climber;
      const from = before[seat];
      const to = after[seat];
      return { id, kind: 'climb', seat, text: `${name(seat)} climbs from ${ordinal(from)} to ${ordinal(to)}` };
    }
  }
  return null;
}

/** Each seat's rank (1 = best, ties share). */
function rankBySeat(game: GameModule, session: Session): number[] {
  const ranks = new Array<number>(session.players.length).fill(0);
  for (const s of standings(game, session)) ranks[s.index] = s.rank;
  return ranks;
}

function seatsAt(ranks: number[], rank: number): number[] {
  return ranks.flatMap((r, seat) => (r === rank ? [seat] : []));
}
