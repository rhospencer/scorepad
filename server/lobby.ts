import { randomBytes } from 'node:crypto';
import { isAvatarEmoji } from '../src/lib/emoji';
import type {
  Callout,
  LiveRound,
  LiveTrickRound,
  LiveRoundPlayer,
  LobbyPlayer,
  LobbyView,
  Scoreboard,
  ScoreboardRow,
  Submission,
} from '../src/lib/lobbyTypes';

/** Room codes skip I and O so they can't be misread as 1 and 0. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NAME_MAX = 20;
/** Lobbies nobody has touched for this long are dropped. */
const IDLE_MS = 6 * 60 * 60 * 1000;

export class LobbyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Lobby extends Omit<LobbyView, 'submitted' | 'submissions'> {
  hostKey: string;
  /** Player id → secret the phone uses to edit or leave. */
  tokens: Map<string, string>;
  /** Player id → the score their phone sent for the current round. */
  submissions: Map<string, Submission>;
  /** `host` listeners also get the submitted scores. */
  listeners: Set<{ fn: (view: LobbyView) => void; host: boolean }>;
  touchedAt: number;
}

/** Highest score a phone may send for one round. */
const MAX_SCORE = 9_999_999;
/** Lowest score a phone may send in games that allow negatives. */
const MAX_NEGATIVE = 999;

/**
 * In-memory game lobbies. The host's screen creates one; phones join it with
 * a 4-letter code; everyone watching gets the new player list on every change.
 */
export class LobbyStore {
  private lobbies = new Map<string, Lobby>();

  constructor(
    private rand: () => number = Math.random,
    private now: () => number = Date.now,
  ) {}

  create(gameName: string, openSlots: number): { code: string; hostKey: string } {
    this.prune();
    const code = this.newCode();
    const hostKey = this.secret();
    this.lobbies.set(code, {
      code,
      gameName: String(gameName).slice(0, 40),
      openSlots: clampSlots(openSlots),
      status: 'open',
      players: [],
      scoreboard: null,
      round: null,
      submissions: new Map(),
      hostKey,
      tokens: new Map(),
      listeners: new Set(),
      touchedAt: this.now(),
    });
    return { code, hostKey };
  }

  view(code: string): LobbyView {
    return toView(this.get(code), false);
  }

  join(code: string, name: unknown, emoji: unknown): { player: LobbyPlayer; token: string } {
    const lobby = this.get(code);
    if (lobby.status !== 'open') throw new LobbyError(409, 'This game has already started.');
    if (lobby.players.length >= lobby.openSlots) throw new LobbyError(409, 'This game is full.');
    const player: LobbyPlayer = { id: this.secret(8), name: this.checkName(lobby, name), emoji: checkEmoji(emoji) };
    const token = this.secret();
    lobby.players.push(player);
    lobby.tokens.set(player.id, token);
    this.changed(lobby);
    return { player, token };
  }

  /** A player changes their own name or emoji before the game starts. */
  update(code: string, id: string, token: unknown, changes: { name?: unknown; emoji?: unknown }): LobbyPlayer {
    const lobby = this.get(code);
    const player = this.playerFor(lobby, id, token);
    if (lobby.status !== 'open') throw new LobbyError(409, 'This game has already started.');
    if (changes.name !== undefined) player.name = this.checkName(lobby, changes.name, id);
    if (changes.emoji !== undefined) player.emoji = checkEmoji(changes.emoji);
    this.changed(lobby);
    return player;
  }

  /** A player leaves (with their token), or the host removes them (with the host key). */
  remove(code: string, id: string, auth: { token?: unknown; hostKey?: unknown }): void {
    const lobby = this.get(code);
    if (auth.hostKey !== undefined) this.checkHost(lobby, auth.hostKey);
    else this.playerFor(lobby, id, auth.token);
    const before = lobby.players.length;
    lobby.players = lobby.players.filter((p) => p.id !== id);
    lobby.tokens.delete(id);
    lobby.submissions.delete(id);
    if (lobby.players.length !== before) this.changed(lobby);
  }

  /** The host frees or takes seats as they type players in by hand. */
  setOpenSlots(code: string, hostKey: unknown, openSlots: number): void {
    const lobby = this.get(code);
    this.checkHost(lobby, hostKey);
    lobby.openSlots = clampSlots(openSlots);
    this.changed(lobby);
  }

  /** The host's latest standings, relayed to every phone. */
  setScoreboard(code: string, hostKey: unknown, scoreboard: unknown): void {
    this.publish(code, hostKey, { scoreboard });
  }

  /**
   * The host's live state: standings and/or the round phones can score. A new round
   * (or a new game) drops scores sent for the old one. `round: null` stops scoring.
   */
  publish(code: string, hostKey: unknown, live: { scoreboard?: unknown; round?: unknown }): void {
    const lobby = this.get(code);
    this.checkHost(lobby, hostKey);
    if (live.scoreboard !== undefined) lobby.scoreboard = cleanScoreboard(live.scoreboard);
    if (live.round !== undefined) {
      lobby.round = live.round === null ? null : cleanRound(live.round);
      for (const [id, sub] of lobby.submissions) {
        const stale = !lobby.round || sub.gameId !== lobby.round.gameId || sub.round !== lobby.round.round;
        // Bid-and-tricks: once bids lock, sent bids are done with (and vice versa).
        const otherPhase = !!lobby.round?.trick && sub.phase !== lobby.round.trick.phase;
        if (stale || otherPhase) {
          lobby.submissions.delete(id);
        }
      }
    }
    this.changed(lobby);
  }

  /** A phone sends its score for the current round. Sending again replaces it until the host approves. */
  submit(
    code: string,
    id: string,
    token: unknown,
    body: { gameId?: unknown; round?: unknown; value?: unknown; special?: unknown; phase?: unknown; bid?: unknown; tricks?: unknown; captures?: unknown },
  ): void {
    const lobby = this.get(code);
    this.playerFor(lobby, id, token);
    const live = lobby.round;
    if (!live || body.gameId !== live.gameId || body.round !== live.round) {
      throw new LobbyError(409, 'That round is over. Your screen will catch up in a moment.');
    }
    const me = live.players.find((p) => p.lobbyId === id);
    if (!me || me.state === 'sittingOut') throw new LobbyError(409, 'You don’t have a turn this round.');
    if (me.state === 'approved') throw new LobbyError(409, 'The host already has your score for this round.');
    if (live.trick) {
      lobby.submissions.set(id, trickSubmission(live, body));
      this.changed(lobby);
      return;
    }
    const special = body.special === true;
    if (special && !live.special) throw new LobbyError(400, 'Bad request.');
    if (special && live.special?.exclusive && live.special.takenBy) {
      throw new LobbyError(409, `${live.special.takenBy} already went out this round.`);
    }
    // A special with its own score (Out, Farkle) sets it; a plain mark (Kombio caller) keeps the typed total.
    const fixed = special ? live.special!.score : null;
    const value = fixed ?? Number(body.value);
    const min = live.allowNegative ? -MAX_NEGATIVE : 0;
    if (!Number.isInteger(value) || value < min || value > MAX_SCORE) throw new LobbyError(400, 'Enter a whole number.');
    lobby.submissions.set(id, { gameId: live.gameId, round: live.round, value, special });
    this.changed(lobby);
  }

  /** Clear a sent score: the host sends it back, or the phone takes it back. */
  withdraw(code: string, id: string, auth: { token?: unknown; hostKey?: unknown }): void {
    const lobby = this.get(code);
    if (auth.hostKey !== undefined) this.checkHost(lobby, auth.hostKey);
    else this.playerFor(lobby, id, auth.token);
    if (lobby.submissions.delete(id)) this.changed(lobby);
  }

  start(code: string, hostKey: unknown): void {
    this.setStatus(code, hostKey, 'started');
  }

  /** The host backed out of setup. Phones are told the game was cancelled. */
  close(code: string, hostKey: unknown): void {
    this.setStatus(code, hostKey, 'closed');
  }

  /**
   * Calls `fn` now and after every change. Returns an unsubscribe function.
   * With the right host key, the views include the scores phones sent.
   */
  subscribe(code: string, fn: (view: LobbyView) => void, hostKey?: unknown): () => void {
    const lobby = this.get(code);
    const listener = { fn, host: hostKey !== undefined && hostKey === lobby.hostKey };
    lobby.listeners.add(listener);
    fn(toView(lobby, listener.host));
    return () => lobby.listeners.delete(listener);
  }

  /** The host's view, with submitted scores. */
  hostView(code: string, hostKey: unknown): LobbyView {
    const lobby = this.get(code);
    this.checkHost(lobby, hostKey);
    return toView(lobby, true);
  }

  /** Drop lobbies idle for hours. Called on create, so memory stays small without a timer. */
  prune(): void {
    const cutoff = this.now() - IDLE_MS;
    for (const [code, lobby] of this.lobbies) {
      if (lobby.touchedAt < cutoff && lobby.listeners.size === 0) this.lobbies.delete(code);
    }
  }

  private setStatus(code: string, hostKey: unknown, status: LobbyView['status']) {
    const lobby = this.get(code);
    this.checkHost(lobby, hostKey);
    if (lobby.status === status) return;
    lobby.status = status;
    this.changed(lobby);
  }

  private get(code: string): Lobby {
    const lobby = this.lobbies.get(String(code).toUpperCase());
    if (!lobby) throw new LobbyError(404, 'No game with that code. Check the code on the host’s screen.');
    return lobby;
  }

  private checkHost(lobby: Lobby, hostKey: unknown) {
    if (hostKey !== lobby.hostKey) throw new LobbyError(403, 'Only the host can do that.');
  }

  private playerFor(lobby: Lobby, id: string, token: unknown): LobbyPlayer {
    const player = lobby.players.find((p) => p.id === id);
    if (!player || lobby.tokens.get(id) !== token) throw new LobbyError(404, 'You’re not in this game.');
    return player;
  }

  private checkName(lobby: Lobby, raw: unknown, selfId?: string): string {
    const name = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
    if (!name) throw new LobbyError(400, 'Enter a name.');
    const clash = lobby.players.some((p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new LobbyError(409, 'Someone already has that name.');
    return name;
  }

  private changed(lobby: Lobby) {
    lobby.touchedAt = this.now();
    const phoneView = toView(lobby, false);
    const hostView = toView(lobby, true);
    for (const l of lobby.listeners) l.fn(l.host ? hostView : phoneView);
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(this.rand() * CODE_LETTERS.length)];
      if (!this.lobbies.has(code)) return code;
    }
  }

  private secret(length = 24): string {
    return randomBytes(length).toString('base64url').slice(0, length);
  }
}

function checkEmoji(emoji: unknown): string {
  if (!isAvatarEmoji(emoji)) throw new LobbyError(400, 'Pick an avatar.');
  return emoji;
}

function clampSlots(n: number): number {
  return Math.max(0, Math.min(20, Math.floor(Number(n) || 0)));
}

function toView(lobby: Lobby, host: boolean): LobbyView {
  const view: LobbyView = {
    code: lobby.code,
    gameName: lobby.gameName,
    openSlots: lobby.openSlots,
    status: lobby.status,
    players: lobby.players.map((p) => ({ ...p })),
    scoreboard: lobby.scoreboard,
    round: lobby.round,
    submitted: [...lobby.submissions.keys()],
  };
  if (host) view.submissions = Object.fromEntries([...lobby.submissions].map(([id, s]) => [id, { ...s }]));
  return view;
}

const ROUND_STATES = new Set(['open', 'approved', 'sentBack', 'sittingOut']);

/** Keep only the round fields phones use. */
function cleanRound(raw: unknown): LiveRound {
  if (!raw || typeof raw !== 'object') throw new LobbyError(400, 'Bad round.');
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max = 60) => String(v ?? '').slice(0, max);
  const optText = (v: unknown) => (v === null || v === undefined ? null : text(v));
  const round = Number(r.round);
  if (!Number.isInteger(round) || round < 0) throw new LobbyError(400, 'Bad round.');
  const sp = r.special as Record<string, unknown> | null | undefined;
  return {
    gameId: text(r.gameId),
    round,
    title: text(r.title),
    note: optText(r.note),
    dealer: optText(r.dealer),
    prompt: text(r.prompt),
    maxDigits: Math.max(1, Math.min(7, Math.floor(Number(r.maxDigits) || 5))),
    allowNegative: r.allowNegative === true,
    keypad: (Array.isArray(r.keypad) ? r.keypad.slice(0, 20) : []).map((k: Record<string, unknown>) => ({
      label: text(k.label, 8),
      value: Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(k.value) || 0))),
    })),
    special:
      sp && typeof sp === 'object'
        ? {
            label: text(sp.label, 24),
            score: sp.score === null || sp.score === undefined ? null : Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(sp.score) || 0))),
            exclusive: sp.exclusive === true,
            takenBy: optText(sp.takenBy),
          }
        : null,
    trick: cleanTrick(r.trick),
    players: (Array.isArray(r.players) ? r.players.slice(0, 20) : []).map(
      (p: Record<string, unknown>): LiveRoundPlayer => ({
        lobbyId: typeof p.lobbyId === 'string' ? p.lobbyId.slice(0, 40) : null,
        name: text(p.name, 20),
        ...(isAvatarEmoji(p.emoji) ? { emoji: p.emoji } : {}),
        seat: Math.floor(Number(p.seat) || 0),
        state: (ROUND_STATES.has(String(p.state)) ? p.state : 'open') as LiveRoundPlayer['state'],
      }),
    ),
  };
}

/** Keep only the fields phones use, with sane sizes. The host is trusted, but data still gets checked. */
function cleanScoreboard(raw: unknown): Scoreboard {
  if (!raw || typeof raw !== 'object') throw new LobbyError(400, 'Bad scoreboard.');
  const b = raw as Record<string, unknown>;
  const text = (v: unknown, max = 80) => String(v ?? '').slice(0, max);
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, 20) : [];
  return {
    gameId: text(b.gameId),
    gameName: text(b.gameName, 40),
    status: text(b.status),
    rule: text(b.rule),
    finished: b.finished === true,
    winners: Array.isArray(b.winners) ? b.winners.slice(0, 20).map((w) => text(w, 20)) : [],
    rows: rows.map((r: Record<string, unknown>): ScoreboardRow => ({
      lobbyId: typeof r.lobbyId === 'string' ? r.lobbyId.slice(0, 40) : null,
      name: text(r.name, 20),
      ...(isAvatarEmoji(r.emoji) ? { emoji: r.emoji } : {}),
      seat: num(r.seat),
      total: num(r.total),
      rank: num(r.rank),
      behind: num(r.behind),
      last: r.last === null || r.last === undefined ? null : num(r.last),
    })),
    callout: cleanCallout(b.callout),
  };
}

function cleanCallout(raw: unknown): Callout | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (c.kind !== 'lead' && c.kind !== 'tie' && c.kind !== 'climb') return null;
  return { id: String(c.id ?? '').slice(0, 60), kind: c.kind, seat: Number(c.seat) || 0, text: String(c.text ?? '').slice(0, 80) };
}

/** Check a phone's bid (bid phase) or its tricks and captures (play phase). */
function trickSubmission(
  live: LiveRound,
  body: { phase?: unknown; bid?: unknown; tricks?: unknown; captures?: unknown },
): Submission {
  const trick = live.trick!;
  if (body.phase !== trick.phase) throw new LobbyError(409, 'The round moved on. Your screen will catch up in a moment.');
  const count = (v: unknown) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > trick.cards) throw new LobbyError(400, `Pick a number from 0 to ${trick.cards}.`);
    return n;
  };
  const base = { gameId: live.gameId, round: live.round, value: 0, special: false, phase: trick.phase };
  if (trick.phase === 'bid') return { ...base, bid: count(body.bid) };
  const captures: Record<string, number> = {};
  const raw = body.captures && typeof body.captures === 'object' ? (body.captures as Record<string, unknown>) : {};
  for (const b of trick.bonuses) {
    const n = Number(raw[b.id] ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > trick.cards) throw new LobbyError(400, 'Bad bonus count.');
    if (n > 0) captures[b.id] = n;
  }
  return { ...base, tricks: count(body.tricks), captures };
}

/** Keep only the trick-round fields phones use. */
function cleanTrick(raw: unknown): LiveTrickRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const cards = Math.max(0, Math.min(30, Math.floor(Number(t.cards) || 0)));
  return {
    phase: t.phase === 'play' ? 'play' : 'bid',
    cards,
    bonuses: (Array.isArray(t.bonuses) ? t.bonuses.slice(0, 12) : []).map((b: Record<string, unknown>) => ({
      id: String(b.id ?? '').slice(0, 40),
      label: String(b.label ?? '').slice(0, 60),
      points: Math.max(-999, Math.min(999, Math.floor(Number(b.points) || 0))),
    })),
    bids: Array.isArray(t.bids)
      ? t.bids.slice(0, 20).map((b) => (b === null || b === undefined ? null : Math.max(0, Math.min(cards, Math.floor(Number(b) || 0)))))
      : null,
  };
}
