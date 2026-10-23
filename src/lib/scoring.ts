import type { GameModule, WinnerRule } from './types';

/** Sum each player's column of a round-major score table. */
export function totals(scores: number[][], playerCount: number): number[] {
  const out = new Array<number>(playerCount).fill(0);
  for (const round of scores) {
    for (let p = 0; p < playerCount; p++) out[p] += round[p] ?? 0;
  }
  return out;
}

/** Indexes of the winning player(s). More than one means a tie. */
export function winners(rule: WinnerRule, playerTotals: number[]): number[] {
  if (playerTotals.length === 0) return [];
  if (rule.rule === 'first-to-target') {
    const best = Math.max(...playerTotals);
    return best >= rule.target ? indexesOf(playerTotals, best) : [];
  }
  const best = rule.rule === 'lowest-total' ? Math.min(...playerTotals) : Math.max(...playerTotals);
  return indexesOf(playerTotals, best);
}

/** Which player deals in a given 0-based round when the dealer rotates. */
export function dealerFor(round: number, playerCount: number): number {
  return round % playerCount;
}

/**
 * True once every round of a fixed-round game has been scored, or, for a
 * target-score game, once a finished round leaves someone at or over the target.
 */
export function isFinished(game: GameModule, scores: number[][]): boolean {
  if (game.rounds) return scores.length >= game.rounds.length;
  const hit = targetReached(game, scores);
  if (!hit) return false;
  // Without final turns the game ends with the round that got someone there.
  if (game.winner.rule === 'first-to-target' && !game.winner.finalTurns) return true;
  // Seat 0 reaching the target means everyone else already took their last turn that round.
  return scores.length >= hit.round + (hit.player === 0 ? 1 : 2);
}

/**
 * The first turn that brought a player to the target, in round order and then
 * seat order (seat 0 plays first each round). Null if nobody has got there.
 */
export function targetReached(game: GameModule, scores: number[][]): { round: number; player: number } | null {
  if (game.winner.rule !== 'first-to-target') return null;
  const target = game.winner.target;
  const running = new Array<number>(scores[0]?.length ?? 0).fill(0);
  for (let round = 0; round < scores.length; round++) {
    for (let player = 0; player < running.length; player++) {
      running[player] += scores[round][player] ?? 0;
      if (running[player] >= target) return { round, player };
    }
  }
  return null;
}

/**
 * Once someone reaches the target, every other player gets one last turn.
 * Players seated after them take it later that same round; players seated
 * before them take it in one extra "final turns" round. Null when there's no extra round.
 */
export function finalRound(
  game: GameModule,
  scores: number[][],
): { round: number; reachedBy: number } | null {
  if (game.winner.rule !== 'first-to-target' || !game.winner.finalTurns) return null;
  const hit = targetReached(game, scores);
  if (!hit || hit.player === 0) return null;
  return { round: hit.round + 1, reachedBy: hit.player };
}

/** True when a player has no turn in this round because they already took their last one. */
export function sitsOut(game: GameModule, scores: number[][], round: number, player: number): boolean {
  const final = finalRound(game, scores);
  return final !== null && round === final.round && player >= final.reachedBy;
}

function indexesOf(values: number[], target: number): number[] {
  return values.flatMap((v, i) => (v === target ? [i] : []));
}
