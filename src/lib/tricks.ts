import type { Submission } from './lobbyTypes';
import { recordRound } from './session';
import type { BidTricksRules, GameModule, RoundDraft, Session, TrickEntry } from './types';

/** Helpers for the 'bid-tricks' surface: bids first, then tricks and bonus captures. */

export function emptyTricks(playerCount: number): TrickEntry[] {
  return Array.from({ length: playerCount }, () => ({ bid: null, tricks: null, captures: {} }));
}

export function copyTricks(entries: TrickEntry[]): TrickEntry[] {
  return entries.map((e) => ({ bid: e.bid, tricks: e.tricks, captures: { ...e.captures } }));
}

function rulesOf(game: GameModule): BidTricksRules {
  if (!game.bidTricks) throw new Error(`${game.name} isn't a bid-and-tricks game`);
  return game.bidTricks;
}

/**
 * The draft for a round: a past round reopens in the play phase with its stored
 * bids and tricks; the next round picks up the saved draft, or starts at bids.
 */
export function trickDraftFor(session: Session, round: number): RoundDraft {
  const n = session.players.length;
  const stored = session.tricks?.[round];
  if (round < session.scores.length && stored) {
    return { entries: new Array(n).fill(null), out: null, phase: 'play', tricks: copyTricks(stored) };
  }
  const d = session.draft;
  if (d?.tricks) return { ...d, entries: [...d.entries], tricks: copyTricks(d.tricks), phase: d.phase ?? 'bid' };
  return { entries: new Array(n).fill(null), out: null, phase: 'bid', tricks: emptyTricks(n) };
}

/** Points from bonus captures (counted whether or not the bid was made; `score` decides). */
export function bonusPoints(game: GameModule, captures: Record<string, number>): number {
  return rulesOf(game).bonuses.reduce((sum, b) => sum + b.points * (captures[b.id] ?? 0), 0);
}

/** One player's score for a 0-based round. 0 until both bid and tricks are in. */
export function trickScore(game: GameModule, entry: TrickEntry, round: number): number {
  const rules = rulesOf(game);
  return rules.score(entry, rules.cards(round), bonusPoints(game, entry.captures));
}

export const allBidsIn = (entries: TrickEntry[]) => entries.every((e) => e.bid !== null);
export const allTricksIn = (entries: TrickEntry[]) => entries.every((e) => e.bid !== null && e.tricks !== null);

/** Tricks won across the table; normally this equals the cards dealt. */
export function tricksTaken(entries: TrickEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.tricks ?? 0), 0);
}

/** Set a whole-number field, clamped to 0…cards. Null clears it. */
export function setTrickField(
  game: GameModule,
  entries: TrickEntry[],
  player: number,
  field: 'bid' | 'tricks',
  value: number | null,
  round: number,
): TrickEntry[] {
  const max = rulesOf(game).cards(round);
  const next = copyTricks(entries);
  next[player][field] = value === null ? null : Math.max(0, Math.min(max, Math.floor(value)));
  return next;
}

/** Add (or with -1, remove) one bonus capture for a player. Never below zero. */
export function changeCapture(entries: TrickEntry[], player: number, bonusId: string, delta: 1 | -1): TrickEntry[] {
  const next = copyTricks(entries);
  const count = Math.max(0, (next[player].captures[bonusId] ?? 0) + delta);
  if (count === 0) delete next[player].captures[bonusId];
  else next[player].captures[bonusId] = count;
  return next;
}

/** Store a finished round: work out each score, then save it like any other round. */
export function recordTrickRound(
  game: GameModule,
  session: Session,
  round: number,
  entries: TrickEntry[],
  now = Date.now(),
): Session {
  if (!allTricksIn(entries)) throw new Error('Every player needs a bid and tricks');
  const scores = entries.map((e) => trickScore(game, e, round));
  const next = recordRound(game, session, round, { entries: scores, out: null }, now);
  const tricks = (session.tricks ?? []).map(copyTricks);
  tricks[round] = copyTricks(entries);
  return { ...next, tricks };
}

// ---- Phones sending bids and tricks ----

/**
 * Per player, the phone submission waiting for the host's OK: for this game, round
 * and phase, from a player whose bid (or tricks) isn't in yet.
 */
export function pendingTrickSubmissions(
  session: Session,
  draft: RoundDraft,
  submissions: Record<string, Submission> | undefined,
): (Submission | null)[] {
  const round = session.scores.length;
  const phase = draft.phase ?? 'bid';
  return session.players.map((p, i) => {
    const sub = p.lobbyId ? submissions?.[p.lobbyId] : undefined;
    if (!sub || sub.gameId !== session.id || sub.round !== round || sub.phase !== phase) return null;
    const entry = draft.tricks?.[i];
    if (!entry) return null;
    if (phase === 'bid' ? entry.bid !== null : entry.tricks !== null) return null;
    return sub;
  });
}

/** Accept a phone's bid, or its tricks and captures, depending on the phase. */
export function approveTrickSubmission(game: GameModule, draft: RoundDraft, player: number, sub: Submission, round: number): RoundDraft {
  let tricks = draft.tricks ?? [];
  if (sub.phase === 'bid') tricks = setTrickField(game, tricks, player, 'bid', sub.bid ?? 0, round);
  else {
    tricks = setTrickField(game, tricks, player, 'tricks', sub.tricks ?? 0, round);
    tricks[player].captures = { ...(sub.captures ?? {}) };
  }
  return { ...draft, tricks, sentBack: draft.sentBack?.filter((p) => p !== player) };
}

/** Send a phone's bid (or tricks) back: clear it and mark it so the phone can say so. */
export function sendTrickBack(draft: RoundDraft, player: number): RoundDraft {
  const tricks = copyTricks(draft.tricks ?? []);
  if ((draft.phase ?? 'bid') === 'bid') tricks[player].bid = null;
  else {
    tricks[player].tricks = null;
    tricks[player].captures = {};
  }
  const sentBack = [...(draft.sentBack ?? []).filter((p) => p !== player), player];
  return { ...draft, tricks, sentBack };
}
