import { describe, expect, it } from 'vitest';
import type { LobbyView } from '../src/lib/lobbyTypes';
import { LobbyError, LobbyStore } from './lobby';

function setup(openSlots = 4) {
  let t = 1000;
  const store = new LobbyStore(Math.random, () => t);
  const { code, hostKey } = store.create('Farkle', openSlots);
  return { store, code, hostKey, advance: (ms: number) => (t += ms) };
}

function errorOf(fn: () => unknown): LobbyError {
  try {
    fn();
  } catch (e) {
    if (e instanceof LobbyError) return e;
  }
  throw new Error('expected a LobbyError');
}

describe('LobbyStore', () => {
  it('opens a lobby with a 4-letter code', () => {
    const { store, code } = setup();
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(store.view(code)).toEqual({ code, gameName: 'Farkle', openSlots: 4, status: 'open', players: [], scoreboard: null, round: null, submitted: [] });
  });

  it('finds a lobby whatever case the code is typed in', () => {
    const { store, code } = setup();
    expect(store.view(code.toLowerCase()).code).toBe(code);
  });

  it('lets phones join with a name and emoji', () => {
    const { store, code } = setup();
    const { player, token } = store.join(code, '  Ana  ', '🦊');
    expect(player).toMatchObject({ name: 'Ana', emoji: '🦊' });
    expect(token).toBeTruthy();
    expect(store.view(code).players).toEqual([player]);
  });

  it('passes a phone’s lasting id to the host only, and drops malformed ones', () => {
    const { store, code, hostKey } = setup();
    const { player } = store.join(code, 'Ana', '🦊', 'a1b2c3d4-e5f6-7890-abcd-ef0123456789');
    store.join(code, 'Ben', '🐼', '<script>');
    expect(store.view(code).players.map((p) => p.personId)).toEqual([undefined, undefined]);
    expect(store.hostView(code, hostKey).players.map((p) => p.personId)).toEqual([
      'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      undefined,
    ]);
    expect(player.personId).toBe('a1b2c3d4-e5f6-7890-abcd-ef0123456789');
  });

  it('rejects blank names, duplicate names, and unknown emoji', () => {
    const { store, code } = setup();
    store.join(code, 'Ana', '🦊');
    expect(errorOf(() => store.join(code, '   ', '🐼')).status).toBe(400);
    expect(errorOf(() => store.join(code, 'ana', '🐼')).message).toMatch(/already has that name/);
    expect(errorOf(() => store.join(code, 'Ben', 'x')).status).toBe(400);
  });

  it('stops joins when full or cancelled, and for unknown codes', () => {
    const { store, code, hostKey } = setup(1);
    store.join(code, 'Ana', '🦊');
    expect(errorOf(() => store.join(code, 'Ben', '🐼')).message).toMatch(/full/);
    store.close(code, hostKey);
    expect(errorOf(() => store.join(code, 'Ben', '🐼')).message).toMatch(/cancelled/);
    expect(errorOf(() => store.join('ZZZZ', 'Ben', '🐼')).status).toBe(404);
  });

  it('lets phones ask to join a game under way, past the open seats', () => {
    const { store, code, hostKey } = setup(1);
    store.join(code, 'Ana', '🦊');
    store.start(code, hostKey);
    const { player } = store.join(code, 'Maya', '🦩');
    expect(store.view(code).players.map((p) => p.id)).toContain(player.id);
  });

  it('lets a player change their emoji or name with their token only', () => {
    const { store, code } = setup();
    const { player, token } = store.join(code, 'Ana', '🦊');
    store.update(code, player.id, token, { emoji: '🐙', name: 'Annie' });
    expect(store.view(code).players[0]).toMatchObject({ name: 'Annie', emoji: '🐙' });
    expect(errorOf(() => store.update(code, player.id, 'wrong', { emoji: '🐼' })).status).toBe(404);
  });

  it('lets a player leave, or the host remove them', () => {
    const { store, code, hostKey } = setup();
    const a = store.join(code, 'Ana', '🦊');
    const b = store.join(code, 'Ben', '🐼');
    store.remove(code, a.player.id, { token: a.token });
    store.remove(code, b.player.id, { hostKey });
    expect(store.view(code).players).toEqual([]);
    const c = store.join(code, 'Cy', '🐸');
    expect(errorOf(() => store.remove(code, c.player.id, { hostKey: 'nope' })).status).toBe(403);
  });

  it('only lets the host start or close the lobby', () => {
    const { store, code, hostKey } = setup();
    expect(errorOf(() => store.start(code, 'nope')).status).toBe(403);
    store.close(code, hostKey);
    expect(store.view(code).status).toBe('closed');
  });

  it('sends the lobby to subscribers now and on every change', () => {
    const { store, code, hostKey } = setup();
    const seen: LobbyView[] = [];
    const stop = store.subscribe(code, (v) => seen.push(v));
    store.join(code, 'Ana', '🦊');
    store.start(code, hostKey);
    stop();
    store.close(code, hostKey);
    expect(seen.map((v) => [v.status, v.players.length])).toEqual([
      ['open', 0],
      ['open', 1],
      ['started', 1],
    ]);
  });

  it('drops lobbies idle for hours', () => {
    const { store, code, advance } = setup();
    advance(7 * 60 * 60 * 1000);
    store.create('Five Crowns', 4);
    expect(errorOf(() => store.view(code)).status).toBe(404);
  });

  it('relays the host’s scoreboard, keeping only known fields', () => {
    const { store, code, hostKey } = setup();
    const seen: (LobbyView['scoreboard'])[] = [];
    store.subscribe(code, (v) => seen.push(v.scoreboard));
    store.setScoreboard(code, hostKey, {
      gameId: 'g1',
      gameName: 'Farkle',
      status: 'After round 1',
      rule: 'Highest score wins',
      finished: false,
      winners: [],
      rows: [{ lobbyId: 'p1', name: 'Ana', emoji: '🦊', seat: 0, total: 350, rank: 1, behind: 0, last: 350, extra: 'x' }],
      junk: true,
    });
    const board = seen.at(-1)!;
    expect(board.rows).toEqual([{ lobbyId: 'p1', name: 'Ana', emoji: '🦊', seat: 0, total: 350, rank: 1, behind: 0, last: 350 }]);
    expect(board).not.toHaveProperty('junk');
    expect(errorOf(() => store.setScoreboard(code, 'nope', {})).status).toBe(403);
    expect(errorOf(() => store.setScoreboard(code, hostKey, 'nope')).status).toBe(400);
  });

  describe('phone scores', () => {
    function liveGame() {
      const ctx = setup();
      const a = ctx.store.join(ctx.code, 'Ana', '🦊');
      const b = ctx.store.join(ctx.code, 'Ben', '🐼');
      ctx.store.start(ctx.code, ctx.hostKey);
      const round = (n: number, states: Record<string, string> = {}, takenBy: string | null = null) => ({
        gameId: 'g1',
        round: n,
        title: `Round ${n + 1}`,
        note: null,
        dealer: null,
        prompt: 'Cards left in your hand',
        keypad: [{ label: 'Q', value: 12 }],
        special: { label: 'I went out', score: 0, exclusive: true, takenBy },
        players: [
          { lobbyId: a.player.id, name: 'Ana', seat: 0, state: states.a ?? 'open' },
          { lobbyId: b.player.id, name: 'Ben', seat: 1, state: states.b ?? 'open' },
          { lobbyId: null, name: 'Cy', seat: 2, state: 'open' },
        ],
      });
      ctx.store.publish(ctx.code, ctx.hostKey, { round: round(0) });
      return { ...ctx, a, b, round };
    }

    it('takes a score for the current round and shows only the host what it is', () => {
      const { store, code, hostKey, a } = liveGame();
      store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 24, special: false });
      expect(store.view(code).submitted).toEqual([a.player.id]);
      expect(store.view(code).submissions).toBeUndefined();
      expect(store.hostView(code, hostKey).submissions).toEqual({
        [a.player.id]: { gameId: 'g1', round: 0, value: 24, special: false },
      });
    });

    it('sends the host its own view over the live stream', () => {
      const { store, code, hostKey, a } = liveGame();
      const host: LobbyView[] = [];
      const phone: LobbyView[] = [];
      store.subscribe(code, (v) => host.push(v), hostKey);
      store.subscribe(code, (v) => phone.push(v));
      store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 7, special: false });
      expect(host.at(-1)!.submissions?.[a.player.id]?.value).toBe(7);
      expect(phone.at(-1)!.submissions).toBeUndefined();
    });

    it('rejects stale rounds, approved players, bad numbers, and a taken Out', () => {
      const { store, code, hostKey, a, b, round } = liveGame();
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 1, value: 5 })).status).toBe(409);
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: -1 })).status).toBe(400);
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 1.5 })).status).toBe(400);
      store.publish(code, hostKey, { round: round(0, { a: 'approved', b: 'open' }, 'Ana') });
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 5 })).message).toMatch(/already has your score/);
      expect(errorOf(() => store.submit(code, b.player.id, b.token, { gameId: 'g1', round: 0, special: true })).message).toMatch(/Ana already went out/);
    });

    it('uses the game score for Out, and replaces a resent score', () => {
      const { store, code, hostKey, a } = liveGame();
      store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 30, special: false });
      store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 99, special: true });
      expect(store.hostView(code, hostKey).submissions?.[a.player.id]).toMatchObject({ value: 0, special: true });
    });

    it('lets the host send a score back, and drops scores when the round moves on', () => {
      const { store, code, hostKey, a, b, round } = liveGame();
      store.submit(code, a.player.id, a.token, { gameId: 'g1', round: 0, value: 30 });
      store.submit(code, b.player.id, b.token, { gameId: 'g1', round: 0, value: 12 });
      store.withdraw(code, a.player.id, { hostKey });
      expect(store.view(code).submitted).toEqual([b.player.id]);
      store.publish(code, hostKey, { round: round(1) });
      expect(store.view(code).submitted).toEqual([]);
      expect(errorOf(() => store.withdraw(code, b.player.id, { hostKey: 'nope' })).status).toBe(403);
    });
  });

  describe('bid-and-tricks rounds', () => {
    function trickGame(phase: 'bid' | 'play') {
      const ctx = setup();
      const a = ctx.store.join(ctx.code, 'Ana', '🦊');
      ctx.store.start(ctx.code, ctx.hostKey);
      const round = (p: 'bid' | 'play') => ({
        gameId: 'sk',
        round: 2,
        title: '3 cards',
        note: null,
        dealer: null,
        prompt: 'x',
        keypad: [],
        special: null,
        players: [{ lobbyId: a.player.id, name: 'Ana', seat: 0, state: 'open' }],
        trick: { phase: p, cards: 3, bonuses: [{ id: 'fourteen', label: 'Standard 14', points: 10 }], bids: null },
      });
      ctx.store.publish(ctx.code, ctx.hostKey, { round: round(phase) });
      return { ...ctx, a, round };
    }

    it('takes a bid within the cards dealt, for the current phase', () => {
      const { store, code, hostKey, a } = trickGame('bid');
      store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'bid', bid: 2 });
      expect(store.hostView(code, hostKey).submissions?.[a.player.id]).toMatchObject({ phase: 'bid', bid: 2 });
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'bid', bid: 4 })).status).toBe(400);
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'play', tricks: 1 })).status).toBe(409);
    });

    it('drops sent bids when the host locks bids and play starts', () => {
      const { store, code, hostKey, a, round } = trickGame('bid');
      store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'bid', bid: 1 });
      store.publish(code, hostKey, { round: round('play') });
      expect(store.view(code).submitted).toEqual([]);
    });

    it('takes tricks with known bonus captures only', () => {
      const { store, code, hostKey, a } = trickGame('play');
      store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'play', tricks: 1, captures: { fourteen: 2, junk: 9 } });
      expect(store.hostView(code, hostKey).submissions?.[a.player.id]).toMatchObject({ tricks: 1, captures: { fourteen: 2 } });
      expect(errorOf(() => store.submit(code, a.player.id, a.token, { gameId: 'sk', round: 2, phase: 'play', tricks: 1, captures: { fourteen: 9 } })).status).toBe(400);
    });
  });

  describe('mark-only specials and negative scores (Kombio)', () => {
    function kombioRound(allowNegative: boolean) {
      const ctx = setup();
      const a = ctx.store.join(ctx.code, 'Ana', '🦊');
      ctx.store.start(ctx.code, ctx.hostKey);
      ctx.store.publish(ctx.code, ctx.hostKey, {
        round: {
          gameId: 'k', round: 0, title: 'Round 1', note: null, dealer: null, prompt: 'x', keypad: [], allowNegative,
          special: { label: 'I called KOMBIO', score: null, exclusive: true, takenBy: null },
          players: [{ lobbyId: a.player.id, name: 'Ana', seat: 0, state: 'open' }],
        },
      });
      return { ...ctx, a };
    }

    it('keeps the typed total when the special only marks the caller', () => {
      const { store, code, hostKey, a } = kombioRound(true);
      store.submit(code, a.player.id, a.token, { gameId: 'k', round: 0, value: 7, special: true });
      expect(store.hostView(code, hostKey).submissions?.[a.player.id]).toMatchObject({ value: 7, special: true });
    });

    it('allows negative totals only where the game allows them', () => {
      const k = kombioRound(true);
      k.store.submit(k.code, k.a.player.id, k.a.token, { gameId: 'k', round: 0, value: -15 });
      expect(k.store.hostView(k.code, k.hostKey).submissions?.[k.a.player.id]?.value).toBe(-15);
      const f = kombioRound(false);
      expect(errorOf(() => f.store.submit(f.code, f.a.player.id, f.a.token, { gameId: 'k', round: 0, value: -15 })).status).toBe(400);
    });
  });
});

describe('bringing a lobby back after a restart', () => {
  it('restores the same code, key and players, and leaves a live lobby alone', () => {
    const store = new LobbyStore();
    const hostKey = 'k'.repeat(24);
    store.restore('abcd', hostKey, { gameName: 'Farkle', players: [{ id: 'ph0ne1', name: 'Ana', emoji: '🦊' }, { id: 'bad id!', name: 'X', emoji: '🐼' }] });
    expect(store.view('ABCD')).toMatchObject({ code: 'ABCD', status: 'started', players: [{ id: 'ph0ne1', name: 'Ana', emoji: '🦊' }] });
    expect(store.hostView('ABCD', hostKey).players[0].waiting).toBe(true);
    store.restore('ABCD', hostKey, { players: [] }); // already here: no change
    expect(store.view('ABCD').players).toHaveLength(1);
    expect(errorOf(() => store.restore('ABCD', 'x'.repeat(24), {})).status).toBe(403);
  });

  it('lets a phone take its spot back with the secret it saved, and only that phone', () => {
    const store = new LobbyStore();
    const hostKey = 'k'.repeat(24);
    store.restore('WXYZ', hostKey, { players: [{ id: 'ph0ne2', name: 'Ben', emoji: '🐼' }] });
    const saved = 't'.repeat(24);
    store.withdraw('WXYZ', 'ph0ne2', { token: saved }); // the phone's first request sets its secret
    expect(store.hostView('WXYZ', hostKey).players[0].waiting).toBeUndefined();
    expect(errorOf(() => store.withdraw('WXYZ', 'ph0ne2', { token: 'z'.repeat(24) })).status).toBe(404);
  });
});

describe('a player’s own QR code', () => {
  it('makes a spot with a one-time secret that a phone claims', () => {
    const { store, code, hostKey } = setup(0);
    store.start(code, hostKey);
    const { player, claim } = store.seat(code, hostKey, { name: 'Ben', emoji: '🐻' });
    expect(store.hostView(code, hostKey).players.find((p) => p.id === player.id)?.waiting).toBe(true);
    const got = store.claimSeat(code, claim);
    expect(got.player.id).toBe(player.id);
    expect(store.hostView(code, hostKey).players.find((p) => p.id === player.id)?.waiting).toBeUndefined();
    expect(errorOf(() => store.claimSeat(code, claim)).message).toMatch(/already used/);
  });

  it('moves a player to a new phone: the old phone’s secret stops working', () => {
    const { store, code, hostKey } = setup();
    const old = store.join(code, 'Ana', '🦊');
    const { claim } = store.seat(code, hostKey, { id: old.player.id, name: 'Ana', emoji: '🦊' });
    expect(store.view(code).players).toHaveLength(1);
    const fresh = store.claimSeat(code, claim);
    expect(fresh.token).not.toBe(old.token);
    expect(errorOf(() => store.remove(code, old.player.id, { token: old.token })).status).toBe(404);
  });

  it('only the host can make one', () => {
    const { store, code } = setup();
    expect(errorOf(() => store.seat(code, 'nope', { name: 'Ben', emoji: '🐻' })).status).toBe(403);
  });
});

describe('the score race on phones', () => {
  it('passes the chart’s numbers through, and drops bad ones', () => {
    const { store, code, hostKey } = setup();
    const race = { low: true, players: [{ name: 'Ana', emoji: '🦊', seat: 0 }], series: [[0, 10, 'x']], from: [0] };
    const board = { gameId: 'g', gameName: 'G', status: '', rule: '', finished: false, winners: [], rows: [], race };
    store.publish(code, hostKey, { scoreboard: board });
    expect(store.view(code).scoreboard?.race).toEqual({ ...race, series: [[0, 10, 0]] });
    store.publish(code, hostKey, { scoreboard: { ...board, race: { players: [], series: [] } } });
    expect(store.view(code).scoreboard?.race).toBeNull();
  });
});
