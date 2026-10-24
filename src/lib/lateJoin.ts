import { finalRound, totals } from './scoring';
import { gameOver, MAX_PLAYERS, newId } from './session';
import type { GameModule, Player, Session } from './types';

/** How a late player's starting score is set. */
export type LateStart = 'last' | 'lastPlus' | 'average' | 'fixed' | 'none';

export interface LateStartChoice {
  id: LateStart;
  label: string;
  /** The starting score this choice gives right now. */
  value: number;
}

/**
 * The host's choices for a late player's starting score, with the numbers they give.
 * Lowest-wins games default to matching last place (the highest total), so joining late
 * isn't a head start; highest-wins games default to 0, which is already behind.
 * `extra` is the "+ X" amount and `fixed` the set amount the host typed.
 */
export function lateStartChoices(game: GameModule, session: Session, extra = 10, fixed = 50): LateStartChoice[] {
  const t = totals(session.scores, session.players.length);
  const low = game.winner.rule === 'lowest-total';
  const last = t.length === 0 ? 0 : low ? Math.max(...t) : Math.min(...t);
  const average = t.length === 0 ? 0 : Math.round(t.reduce((a, b) => a + b, 0) / t.length);
  const cap = (v: number) => capStart(game, v);
  return [
    { id: 'last', label: 'Match last place', value: cap(last) },
    { id: 'lastPlus', label: 'Last place +', value: cap(last + (low ? extra : -extra)) },
    { id: 'average', label: 'Table average', value: cap(average) },
    { id: 'fixed', label: 'Set amount', value: cap(fixed) },
    { id: 'none', label: low ? 'No penalty' : 'Start at 0', value: 0 },
  ];
}

export function defaultLateStart(game: GameModule): LateStart {
  return game.winner.rule === 'lowest-total' ? 'last' : 'none';
}

/** A starting score can't end the game on its own: keep it under the game's end score. */
function capStart(game: GameModule, value: number): number {
  const w = game.winner;
  if (w.rule === 'lowest-total' && w.endAt !== undefined) return Math.min(value, w.endAt - 1);
  if (w.rule === 'first-to-target') return Math.min(value, w.target - 1);
  return value;
}

/** Why a player can't be added right now, or null when they can. */
export function cantAddReason(game: GameModule, session: Session): string | null {
  if (gameOver(game, session)) return 'The game is over.';
  if (session.players.length >= MAX_PLAYERS) return `Games can have up to ${MAX_PLAYERS} players.`;
  const final = finalRound(game, session.scores);
  if (final && session.scores.length >= final.round) return 'It’s the final turns. Add them next game.';
  if (game.surface === 'bid-tricks' && session.draft?.phase === 'play') {
    return 'Bids are locked for this round. Add them once it’s scored.';
  }
  return null;
}

/**
 * Add a player from the round being played now. Rounds they missed score 0, except the
 * last one, which holds their starting score (so every total adds up as usual).
 */
export function addLatePlayer(
  game: GameModule,
  session: Session,
  input: { name: string; emoji?: string; lobbyId?: string; personId?: string },
  start: number,
): Session {
  const reason = cantAddReason(game, session);
  if (reason) throw new Error(reason);
  const round = session.scores.length;
  const player: Player = {
    id: newId(),
    name: input.name.trim() || `Player ${session.players.length + 1}`,
    ...(input.emoji ? { emoji: input.emoji } : {}),
    ...(input.lobbyId ? { lobbyId: input.lobbyId } : {}),
    ...(input.personId ? { personId: input.personId } : {}),
    ...(round > 0 ? { joinedRound: round } : {}),
  };
  const scores = session.scores.map((r, i) => [...r, i === round - 1 ? capStart(game, start) : 0]);
  const tricks = session.tricks?.map((r) => [...r, { bid: 0, tricks: 0, captures: {} }]);
  const draft = session.draft && {
    ...session.draft,
    entries: [...session.draft.entries, null],
    ...(session.draft.tricks ? { tricks: [...session.draft.tricks, { bid: null, tricks: null, captures: {} }] } : {}),
  };
  return {
    ...session,
    players: [...session.players, player],
    scores,
    ...(tricks ? { tricks } : {}),
    ...(draft ? { draft } : {}),
  };
}

/** True for a round this player missed (before they joined). The round just before holds their starting score. */
export function missedRound(player: Player, round: number): boolean {
  return player.joinedRound !== undefined && round < player.joinedRound;
}

/**
 * Link a phone to a player already in the game, so they send their own scores from now on:
 * a player the host typed in, or one rejoining from a new phone (the old one is let go).
 * They keep their name, seat and scores; the phone's avatar fills in if they had none.
 */
export function linkPhone(session: Session, seat: number, phone: { lobbyId: string; emoji?: string; personId?: string }): Session {
  if (!session.players[seat]) throw new Error('No player in that seat.');
  const players = session.players.map((p, i) =>
    i === seat
      ? {
          ...p,
          lobbyId: phone.lobbyId,
          ...(!p.emoji && phone.emoji ? { emoji: phone.emoji } : {}),
          ...(!p.personId && phone.personId ? { personId: phone.personId } : {}),
        }
      : p,
  );
  return { ...session, players };
}
