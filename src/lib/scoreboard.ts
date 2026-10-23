import { roundCallout } from './callout';
import { finalRound, sitsOut } from './scoring';
import { gameOver, sessionWinners, standings } from './session';
import type { Scoreboard } from './lobbyTypes';
import type { GameModule, Session } from './types';

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** How a game is won, in a few words: shown on results and on phones. */
export function ruleText(game: GameModule): string {
  switch (game.winner.rule) {
    case 'lowest-total':
      return 'Lowest score wins';
    case 'first-to-target':
      return `Played to ${game.winner.target.toLocaleString('en-US')} · highest score wins`;
    default:
      return 'Highest score wins';
  }
}

/** The standings phones show, built from the host's game after every change. */
export function buildScoreboard(game: GameModule, session: Session): Scoreboard {
  const scored = session.scores.length;
  const finished = gameOver(game, session);
  const final = finalRound(game, session.scores);
  const lastRound = scored - 1;

  let status: string;
  if (finished) status = 'Final scores';
  else if (scored === 0) status = 'Round 1 under way';
  else if (final && scored === final.round) {
    status = `Final turns · ${session.players[final.reachedBy].name} reached the target`;
  } else status = `After round ${scored}${game.rounds ? ` of ${game.rounds.length}` : ''}`;

  return {
    gameId: session.id,
    gameName: game.name,
    status,
    rule: ruleText(game),
    finished,
    winners: finished ? sessionWinners(game, session).map((i) => session.players[i].name) : [],
    callout: roundCallout(game, session),
    rows: standings(game, session).map((s) => ({
      lobbyId: s.player.lobbyId ?? null,
      name: s.player.name,
      ...(s.player.emoji ? { emoji: s.player.emoji } : {}),
      seat: s.index,
      total: s.total,
      rank: s.rank,
      behind: s.behind,
      last: scored === 0 || sitsOut(game, session.scores, lastRound, s.index) ? null : session.scores[lastRound][s.index],
    })),
  };
}
