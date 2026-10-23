import { sitsOut } from './scoring';
import { standings } from './session';
import type { GameModule, Session } from './types';

export interface GameStat {
  label: string;
  value: string;
}

const num = new Intl.NumberFormat('en-US');

/**
 * A few fun facts for the results screen, picked to suit the game:
 * who went out (or farkled) most, the worst hand or best turn, and how close it was.
 */
export function gameStats(game: GameModule, session: Session): GameStat[] {
  const stats: GameStat[] = [];
  const { players, scores } = session;
  if (scores.length === 0 || players.length === 0) return stats;
  const rules = game.roundGrid;

  // Turns that actually happened (final-turn rounds leave some players out).
  const turns = scores.flatMap((round, r) =>
    round.flatMap((value, p) => (sitsOut(game, scores, r, p) ? [] : [{ r, p, value }])),
  );

  if (rules?.out) {
    const counts = players.map((_, p) => session.outs.filter((o) => o === p).length);
    const top = mostOf(counts);
    if (top) stats.push({ label: 'Most times out', value: `${names(session, top.who)} · ${times(top.count)}` });
  } else if (rules?.quickScore) {
    const score = rules.quickScore.score;
    const counts = players.map((_, p) => turns.filter((t) => t.p === p && t.value === score).length);
    const top = mostOf(counts);
    if (top) stats.push({ label: `Most ${rules.quickScore.label.toLowerCase()}s`, value: `${names(session, top.who)} · ${times(top.count)}` });
  }

  if (turns.length > 0) {
    const low = game.winner.rule === 'lowest-total';
    // Lowest-wins games: the biggest hand hurt most. Highest-wins: the biggest turn helped most.
    const pick = turns.reduce((a, b) => (b.value > a.value ? b : a));
    stats.push({
      label: low ? 'Worst hand' : game.mode === 'turn-based' ? 'Best turn' : 'Best round',
      value: `${players[pick.p].name} · ${num.format(pick.value)} in round ${pick.r + 1}`,
    });
  }

  const table = standings(game, session);
  if (table.length > 1) {
    const [a, b] = table;
    stats.push({
      label: 'Closest race',
      value: b.behind === 0 ? `${a.player.name} and ${b.player.name} tied` : `${a.player.name} and ${b.player.name}, ${num.format(b.behind)} apart`,
    });
  }
  return stats;
}

/** The highest count and everyone who has it, or null when nobody scored any. */
function mostOf(counts: number[]): { count: number; who: number[] } | null {
  const count = Math.max(0, ...counts);
  if (count === 0) return null;
  return { count, who: counts.flatMap((c, i) => (c === count ? [i] : [])) };
}

function names(session: Session, who: number[]): string {
  const list = who.map((i) => session.players[i].name);
  return list.length <= 2 ? list.join(' & ') : `${list.slice(0, -1).join(', ')} & ${list.at(-1)}`;
}

function times(n: number): string {
  return n === 1 ? 'once' : `${n} times`;
}
