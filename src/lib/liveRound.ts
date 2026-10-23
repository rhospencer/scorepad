import { finalRound, isFinished } from './scoring';
import { dealerIndex, emptyDraft, skippedPlayers } from './session';
import { trickDraftFor } from './tricks';
import type { LiveRound, LiveRoundState, Submission } from './lobbyTypes';
import type { GameModule, RoundDraft, Session } from './types';

/** The draft of the round being entered right now. */
export function currentDraft(session: Session): RoundDraft {
  return session.draft ?? emptyDraft(session.players.length);
}

/**
 * What phones see for the round in progress: its name, how to enter a score,
 * and where each player stands (approved, sent back...). Null once the game is over.
 * Scores themselves are left out so players can't see each other's until the round ends.
 */
export function buildLiveRound(game: GameModule, session: Session): LiveRound | null {
  if (isFinished(game, session.scores)) return null;
  if (game.surface === 'bid-tricks' && game.bidTricks) return buildTrickRound(game, session);
  const round = session.scores.length;
  const draft = currentDraft(session);
  const rules = game.roundGrid;
  const meta = game.rounds?.[round];
  const final = finalRound(game, session.scores);
  const target = game.winner.rule === 'first-to-target' ? game.winner.target : null;
  const dealer = dealerIndex(game, session, round);
  const skip = skippedPlayers(game, session, round);

  let special: LiveRound['special'] = null;
  if (rules?.out) {
    const outPlayer = draft.out !== null && draft.entries[draft.out] === rules.out.score ? draft.out : null;
    special = {
      label: rules.phone?.specialLabel ?? rules.out.label,
      score: rules.out.score,
      exclusive: true,
      takenBy: outPlayer === null ? null : session.players[outPlayer].name,
    };
  } else if (rules?.quickScore) {
    special = { label: rules.phone?.specialLabel ?? rules.quickScore.label, score: rules.quickScore.score, exclusive: false, takenBy: null };
  }

  return {
    gameId: session.id,
    round,
    title: final && round === final.round ? 'Final turns' : (meta?.label ?? `Round ${round + 1}`),
    note: meta?.note ?? (target ? `First to ${target.toLocaleString('en-US')}` : null),
    dealer: dealer === null ? null : session.players[dealer].name,
    prompt: rules?.phone?.prompt ?? rules?.entryLabel ?? 'Your score',
    keypad: rules?.phone?.keypad ?? [],
    special,
    players: session.players.map((p, i) => {
      let state: LiveRoundState = 'open';
      if (skip[i]) state = 'sittingOut';
      else if (draft.entries[i] !== null) state = 'approved';
      else if (draft.sentBack?.includes(i)) state = 'sentBack';
      return {
        lobbyId: p.lobbyId ?? null,
        name: p.name,
        ...(p.emoji ? { emoji: p.emoji } : {}),
        seat: i,
        state,
      };
    }),
  };
}

/**
 * Per player, the phone score waiting for the host's OK: one sent for this game and
 * round, for a player who has no score yet and isn't sitting the round out.
 */
export function pendingSubmissions(
  game: GameModule,
  session: Session,
  draft: RoundDraft,
  submissions: Record<string, Submission> | undefined,
): (Submission | null)[] {
  const round = session.scores.length;
  const skip = skippedPlayers(game, session, round);
  return session.players.map((p, i) => {
    const sub = p.lobbyId ? submissions?.[p.lobbyId] : undefined;
    if (!sub || sub.gameId !== session.id || sub.round !== round) return null;
    if (skip[i] || draft.entries[i] !== null) return null;
    return sub;
  });
}

/**
 * Names in a clash over the one-per-round "Out": more than one phone says they went out,
 * or one does while another player is already marked out. Empty when there's no clash.
 */
export function outConflict(game: GameModule, session: Session, draft: RoundDraft, pending: (Submission | null)[]): string[] {
  const out = game.roundGrid?.out;
  if (!out) return [];
  const claims = pending.flatMap((s, i) => (s?.special ? [i] : []));
  const already = draft.out !== null && draft.entries[draft.out] === out.score ? [draft.out] : [];
  const involved = [...already, ...claims];
  return involved.length > 1 ? involved.map((i) => session.players[i].name) : [];
}

/** The live round for bid-and-tricks games: bids first, then tricks and bonuses. */
function buildTrickRound(game: GameModule, session: Session): LiveRound {
  const rules = game.bidTricks!;
  const round = session.scores.length;
  const draft = trickDraftFor(session, round);
  const phase = draft.phase ?? 'bid';
  const entries = draft.tricks ?? [];
  const dealer = dealerIndex(game, session, round);
  return {
    gameId: session.id,
    round,
    title: game.rounds?.[round]?.label ?? `Round ${round + 1}`,
    note: phase === 'bid' ? 'Bidding' : 'Playing',
    dealer: dealer === null ? null : session.players[dealer].name,
    prompt: phase === 'bid' ? 'How many tricks will you win?' : 'Tricks you won',
    keypad: [],
    special: null,
    players: session.players.map((p, i) => {
      const e = entries[i];
      const done = phase === 'bid' ? e?.bid !== null : e?.tricks !== null;
      let state: LiveRoundState = done ? 'approved' : 'open';
      if (!done && draft.sentBack?.includes(i)) state = 'sentBack';
      return { lobbyId: p.lobbyId ?? null, name: p.name, ...(p.emoji ? { emoji: p.emoji } : {}), seat: i, state };
    }),
    trick: {
      phase,
      cards: rules.cards(round),
      bonuses: rules.bonuses.map((b) => ({ ...b })),
      bids: phase === 'play' ? entries.map((e) => e.bid) : null,
    },
  };
}
