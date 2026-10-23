import { dealerFor, isFinished, sitsOut, totals, winners } from './scoring';
import type { GameModule, Options, Player, PlayerInput, RoundDraft, Session } from './types';

/** The most players any game can have. A practical cap for the screen, not a rule. */
export const MAX_PLAYERS = 20;

/** Random id. Falls back when crypto.randomUUID is missing (plain http on a LAN). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function defaultOptions(game: GameModule): Options {
  return Object.fromEntries(game.options.map((o) => [o.id, o.default]));
}

/** The game as set up for a session: options can change its rounds and winning rule. */
export function configuredGame(game: GameModule, options: Options = defaultOptions(game)): GameModule {
  if (!game.configure) return game;
  return { ...game, ...game.configure({ ...defaultOptions(game), ...options }) };
}

/** Blank names become "Player N". */
export function playerNames(names: string[]): string[] {
  return names.map((n, i) => n.trim() || `Player ${i + 1}`);
}

export function createSession(
  game: GameModule,
  entries: PlayerInput[],
  options: Options = defaultOptions(game),
  now = Date.now(),
): Session {
  if (entries.length < game.players.min || entries.length > MAX_PLAYERS) {
    throw new Error(`${game.name} needs ${game.players.min}–${MAX_PLAYERS} players`);
  }
  const inputs = entries.map((e) => (typeof e === 'string' ? { name: e } : e));
  const players: Player[] = playerNames(inputs.map((e) => e.name)).map((name, i) => {
    const { emoji, lobbyId, personId } = inputs[i];
    return {
      id: newId(),
      name,
      ...(emoji ? { emoji } : {}),
      ...(lobbyId ? { lobbyId } : {}),
      ...(personId ? { personId } : {}),
    };
  });
  const custom = game.custom ? { custom: JSON.parse(JSON.stringify(game.custom)) as typeof game.custom } : {};
  return { id: newId(), gameId: game.id, players, scores: [], outs: [], options, startedAt: now, ...custom };
}

/** A new game with the same players and options. */
export function rematch(session: Session, now = Date.now()): Session {
  return {
    id: newId(),
    gameId: session.gameId,
    players: session.players.map((p) => ({ ...p })),
    scores: [],
    outs: [],
    options: { ...session.options },
    startedAt: now,
    // Same players, same phones: keep publishing to their lobby.
    ...(session.lobby ? { lobby: { ...session.lobby } } : {}),
    ...(session.custom ? { custom: session.custom } : {}),
  };
}

export function emptyDraft(playerCount: number): RoundDraft {
  return { entries: new Array<number | null>(playerCount).fill(null), out: null };
}

/** The draft for a round: the saved draft for the next round, or the stored scores of a past one. */
export function draftFor(session: Session, round: number): RoundDraft {
  if (round < session.scores.length) {
    return { entries: [...session.scores[round]], out: session.outs[round] ?? null };
  }
  return session.draft ? copyDraft(session.draft) : emptyDraft(session.players.length);
}

/** Mark (or unmark) a player as having gone out. Only one player per round. */
export function toggleOut(game: GameModule, draft: RoundDraft, player: number): RoundDraft {
  const out = game.roundGrid?.out;
  if (!out) return draft;
  const entries = [...draft.entries];
  const sentBack = withoutPlayer(draft.sentBack, player);
  // A mark with no score of its own (Kombio's caller) just moves; scores stay as typed.
  if (out.score === undefined) return { ...draft, out: draft.out === player ? null : player, sentBack };
  if (draft.out === player) {
    entries[player] = null;
    return { entries, out: null, sentBack };
  }
  if (draft.out !== null && entries[draft.out] === out.score) entries[draft.out] = null;
  entries[player] = out.score;
  return { entries, out: player, sentBack };
}

/** Set one player's entry. Typing a score for the player marked out unmarks them. */
export function setEntry(draft: RoundDraft, player: number, value: number | null, keepOut = false): RoundDraft {
  const entries = [...draft.entries];
  entries[player] = value;
  const out = draft.out === player && !keepOut ? null : draft.out;
  return { entries, out, sentBack: withoutPlayer(draft.sentBack, player) };
}

/** True when the game's per-round mark doesn't set a score (typing keeps the mark). */
export function outKeepsScore(game: GameModule): boolean {
  return !!game.roundGrid?.out && game.roundGrid.out.score === undefined;
}

/** Accept a score a phone sent. `special` (they tapped Out or Farkle) uses the game's fixed score. */
export function approveSubmission(
  game: GameModule,
  draft: RoundDraft,
  player: number,
  sub: { value: number; special: boolean },
): RoundDraft {
  const rules = game.roundGrid;
  if (sub.special && rules?.out && rules.out.score === undefined) {
    // Kombio: they called it, and sent their hand total too.
    const marked = draft.out === player ? draft : toggleOut(game, draft, player);
    return setEntry(marked, player, sub.value, true);
  }
  if (sub.special && rules?.out) return draft.out === player ? draft : toggleOut(game, draft, player);
  if (sub.special && rules?.quickScore) return setEntry(draft, player, rules.quickScore.score);
  return setEntry(draft, player, sub.value);
}

/** Return a phone's score: clear the entry and remember it was sent back so the phone can say so. */
export function sendBack(draft: RoundDraft, player: number): RoundDraft {
  const next = setEntry(draft, player, null);
  return { ...next, sentBack: [...(next.sentBack ?? []), player] };
}

function withoutPlayer(list: number[] | undefined, player: number): number[] | undefined {
  if (!list?.includes(player)) return list;
  const rest = list.filter((p) => p !== player);
  return rest.length > 0 ? rest : undefined;
}

/** `skip` marks players with no turn this round (see `skippedPlayers`). */
export function draftComplete(draft: RoundDraft, skip: boolean[] = []): boolean {
  return draft.entries.every((v, i) => skip[i] || (v !== null && Number.isFinite(v)));
}

/** Per player: true when they have no turn in this round (they already took their final turn). */
export function skippedPlayers(game: GameModule, session: Session, round: number): boolean[] {
  return session.players.map((_, i) => sitsOut(game, session.scores, round, i));
}

/**
 * Store a round. `round` equal to the number of scored rounds appends a new one;
 * a smaller value replaces a past round. Finishes the session after the last round.
 */
export function recordRound(
  game: GameModule,
  session: Session,
  round: number,
  draft: RoundDraft,
  now = Date.now(),
): Session {
  if (round > session.scores.length) throw new Error('Rounds must be scored in order');
  // Players who sit out score 0 so the table stays rectangular.
  const skip = skippedPlayers(game, session, round);
  draft = { ...draft, entries: draft.entries.map((v, i) => (skip[i] ? 0 : v)) };
  if (!draftComplete(draft)) throw new Error('Every player needs a score');
  const scores = session.scores.map((r) => [...r]);
  const outs = [...session.outs];
  const adjust = game.roundGrid?.adjust;
  scores[round] = adjust ? adjust(draft.entries as number[], draft.out) : (draft.entries as number[]);
  outs[round] = draft.out;
  const appending = round === session.scores.length;
  const next: Session = { ...session, scores, outs, draft: appending ? undefined : session.draft };
  if (isFinished(game, scores) && !next.finishedAt) next.finishedAt = now;
  return next;
}

/** True once the game is over: its rounds or target are done, or the host ended it. */
export function gameOver(game: GameModule, session: Session): boolean {
  return isFinished(game, session.scores) || (!!game.hostEnds && !!session.finishedAt);
}

/** Host-ended games: the host taps End game. Scoring the next round reopens it. */
export function endGame(session: Session, now = Date.now()): Session {
  return { ...session, draft: undefined, finishedAt: now };
}

/** Undo End game, to keep playing. */
export function reopenGame(session: Session): Session {
  const { finishedAt: _, ...rest } = session;
  return rest;
}

export function optionOn(session: Session, id: string | undefined): boolean {
  return id === undefined || session.options[id] !== false;
}

/** Index of the dealer for a 0-based round, or null when the game doesn't track one. */
export function dealerIndex(game: GameModule, session: Session, round: number): number | null {
  if (game.turns.type !== 'dealer-rotation' || !optionOn(session, game.turns.option)) return null;
  return dealerFor(round, session.players.length);
}

export function cheatSheetText(game: GameModule, session: Session): string | null {
  if (!game.cheatSheet || !optionOn(session, game.cheatSheet.option)) return null;
  return game.cheatSheet.text;
}

export interface Standing {
  index: number;
  player: Player;
  total: number;
  /** 1-based, ties share a rank (1, 1, 3). */
  rank: number;
  /** Points between this player and the leader. */
  behind: number;
}

/** Players ordered best first by the game's winner rule. */
export function standings(game: GameModule, session: Session): Standing[] {
  const t = totals(session.scores, session.players.length);
  const low = game.winner.rule === 'lowest-total';
  const order = t.map((total, index) => ({ index, total })).sort((a, b) => (low ? a.total - b.total : b.total - a.total));
  const best = order[0]?.total ?? 0;
  return order.map(({ index, total }) => ({
    index,
    player: session.players[index],
    total,
    rank: 1 + order.filter((o) => (low ? o.total < total : o.total > total)).length,
    behind: Math.abs(total - best),
  }));
}

/** Winner indexes for a finished session (several on a tie). */
export function sessionWinners(game: GameModule, session: Session): number[] {
  return winners(game.winner, totals(session.scores, session.players.length));
}

function copyDraft(draft: RoundDraft): RoundDraft {
  return { entries: [...draft.entries], out: draft.out, ...(draft.sentBack ? { sentBack: [...draft.sentBack] } : {}) };
}
