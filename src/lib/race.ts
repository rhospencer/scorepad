import type { GameModule, Session } from './types';

/** What the score race chart draws: everyone's running total after each round. */
export interface RaceData {
  /** Lowest total wins (the chart says "lower is better"). */
  low: boolean;
  players: { name: string; emoji?: string; seat: number }[];
  /** Per player: [start, after round 1, after round 2, ...]. */
  series: number[][];
  /** Per player: the first point to draw. Late joiners start at the round they joined. */
  from: number[];
}

export function raceData(game: GameModule, session: Session): RaceData {
  return {
    low: game.winner.rule === 'lowest-total',
    players: session.players.map((p, seat) => ({ name: p.name, ...(p.emoji ? { emoji: p.emoji } : {}), seat })),
    series: session.players.map((_, p) => {
      let sum = 0;
      return [0, ...session.scores.map((r) => (sum += r[p] ?? 0))];
    }),
    from: session.players.map((p) => p.joinedRound ?? 0),
  };
}
