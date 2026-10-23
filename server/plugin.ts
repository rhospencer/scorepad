import type { IncomingMessage, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import type { Connect, Plugin } from 'vite';
import type { LobbyNetwork } from '../src/lib/lobbyTypes';
import { LobbyError, LobbyStore } from './lobby';

/**
 * Adds the lobby API to Vite's dev and preview servers, so phones on the same
 * Wi-Fi can join a game the host's screen opened.
 *
 *   GET    /api/network                         this computer's LAN addresses
 *   POST   /api/lobbies                         host opens a lobby  {gameName, openSlots} → {code, hostKey}
 *   GET    /api/lobbies/:code                   lobby snapshot
 *   GET    /api/lobbies/:code/events            live snapshots (Server-Sent Events)
 *   PATCH  /api/lobbies/:code                   host: {hostKey, openSlots?, scoreboard?, status?: 'started' | 'closed'}
 *   POST   /api/lobbies/:code/players           phone joins  {name, emoji} → {player, token}
 *   PATCH  /api/lobbies/:code/players/:id       phone edits  {token, name?, emoji?}
 *   DELETE /api/lobbies/:code/players/:id       phone leaves {token} or host removes {hostKey}
 *   PUT    /api/lobbies/:code/players/:id/score phone sends this round's score {token, gameId, round, value, special}
 *   DELETE /api/lobbies/:code/players/:id/score host sends it back {hostKey}, or phone takes it back {token}
 *
 * The events stream takes ?hostKey=… so the host also gets the scores phones sent.
 */
export function lobbyPlugin(store = new LobbyStore()): Plugin {
  const handler = lobbyMiddleware(store);
  return {
    name: 'scorepad-lobby',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export function lobbyMiddleware(store: LobbyStore): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return next();
    route(store, req, res, url.pathname).catch((err: unknown) => {
      if (err instanceof LobbyError) send(res, err.status, { error: err.message });
      else send(res, 500, { error: 'Something went wrong.' });
    });
  };
}

async function route(store: LobbyStore, req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? 'GET';
  const parts = path.split('/').filter(Boolean).slice(1); // drop "api"

  if (parts[0] === 'network' && parts.length === 1 && method === 'GET') {
    const network: LobbyNetwork = { addresses: lanAddresses(), port: req.socket.localPort ?? 0 };
    return send(res, 200, network);
  }

  if (parts[0] !== 'lobbies') return send(res, 404, { error: 'Not found.' });
  const [, code, sub, id] = parts;

  if (!code && method === 'POST') {
    const body = await readJson(req);
    return send(res, 201, store.create(String(body.gameName ?? ''), Number(body.openSlots)));
  }
  if (!code) return send(res, 405, { error: 'Method not allowed.' });

  if (!sub) {
    if (method === 'GET') return send(res, 200, store.view(code));
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body.openSlots !== undefined) store.setOpenSlots(code, body.hostKey, Number(body.openSlots));
      if (body.scoreboard !== undefined || body.round !== undefined) {
        store.publish(code, body.hostKey, { scoreboard: body.scoreboard, round: body.round });
      }
      if (body.status === 'started') store.start(code, body.hostKey);
      if (body.status === 'closed') store.close(code, body.hostKey);
      return send(res, 200, store.view(code));
    }
  }

  if (sub === 'events' && method === 'GET') return stream(store, code, req, res, hostKeyFrom(req));

  if (sub === 'players') {
    if (!id && method === 'POST') {
      const body = await readJson(req);
      return send(res, 201, store.join(code, body.name, body.emoji));
    }
    if (id && method === 'PATCH') {
      const body = await readJson(req);
      return send(res, 200, store.update(code, id, body.token, { name: body.name, emoji: body.emoji }));
    }
    if (id && method === 'DELETE' && !parts[4]) {
      const body = await readJson(req);
      store.remove(code, id, { token: body.token, hostKey: body.hostKey });
      return send(res, 200, { ok: true });
    }
    if (id && parts[4] === 'score' && method === 'PUT') {
      const body = await readJson(req);
      store.submit(code, id, body.token, body);
      return send(res, 200, { ok: true });
    }
    if (id && parts[4] === 'score' && method === 'DELETE') {
      const body = await readJson(req);
      store.withdraw(code, id, { token: body.token, hostKey: body.hostKey });
      return send(res, 200, { ok: true });
    }
  }

  send(res, 404, { error: 'Not found.' });
}

/** Server-Sent Events: the full lobby on connect and after every change. */
function stream(store: LobbyStore, code: string, req: IncomingMessage, res: ServerResponse, hostKey?: string) {
  // Throws (→ 404/403) before any headers go out if the lobby doesn't exist or the key is wrong.
  if (hostKey) store.hostView(code, hostKey);
  else store.view(code);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const unsubscribe = store.subscribe(code, (view) => res.write(`data: ${JSON.stringify(view)}\n\n`), hostKey);
  // Comments keep idle connections (and phone browsers) from timing out.
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50_000) throw new LobbyError(413, 'Too much data.');
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new LobbyError(400, 'Bad request.');
  }
}

/** IPv4 addresses other devices on the network can reach, Wi-Fi/Ethernet first. */
function lanAddresses(): string[] {
  const found: string[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // en0/eth0/wlan0 are the usual real interfaces; VPNs and bridges go last.
      if (/^(en|eth|wl)/.test(name)) found.unshift(a.address);
      else found.push(a.address);
    }
  }
  return found;
}

/** EventSource can't send headers, so the host passes its key in the query string (LAN only). */
function hostKeyFrom(req: IncomingMessage): string | undefined {
  const key = new URL(req.url ?? '/', 'http://x').searchParams.get('hostKey');
  return key ?? undefined;
}
