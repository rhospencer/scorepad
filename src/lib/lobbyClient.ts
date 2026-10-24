import type { LiveRound, LobbyNetwork, LobbyPlayer, LobbyView, Scoreboard } from './lobbyTypes';

/** An error from the lobby API: the server's message, and its HTTP status (0 = unreachable). */
export class LobbyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** True when the server doesn't know this lobby (it restarted, or the lobby expired). */
export function isMissingLobby(err: unknown): boolean {
  return err instanceof LobbyApiError && err.status === 404;
}

/** Talks to the lobby API in server/plugin.ts. Errors carry the server's message. */
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new LobbyApiError('Can’t reach the host. Are you on the same Wi-Fi?', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new LobbyApiError(data.error ?? 'Something went wrong.', res.status);
  return data;
}

const lobby = (code: string) => `/api/lobbies/${encodeURIComponent(code)}`;

export const lobbyApi = {
  network: () => api<LobbyNetwork>('/api/network'),
  view: (code: string) => api<LobbyView>(lobby(code)),

  // Host
  create: (gameName: string, openSlots: number) =>
    api<{ code: string; hostKey: string }>('/api/lobbies', 'POST', { gameName, openSlots }),
  setOpenSlots: (code: string, hostKey: string, openSlots: number) =>
    api<LobbyView>(lobby(code), 'PATCH', { hostKey, openSlots }),
  /** Standings and the round phones can score (null once the game is over). */
  publish: (code: string, hostKey: string, live: { scoreboard: Scoreboard; round: LiveRound | null }) =>
    api<LobbyView>(lobby(code), 'PATCH', { hostKey, ...live }),
  sendBack: (code: string, hostKey: string, id: string) =>
    api<{ ok: true }>(`${lobby(code)}/players/${id}/score`, 'DELETE', { hostKey }),
  start: (code: string, hostKey: string) => api<LobbyView>(lobby(code), 'PATCH', { hostKey, status: 'started' }),
  close: (code: string, hostKey: string) => api<LobbyView>(lobby(code), 'PATCH', { hostKey, status: 'closed' }),
  /** Bring back a lobby the server forgot, with the same code and the phones already in the game. */
  restore: (
    code: string,
    hostKey: string,
    data: { gameName: string; status: 'open' | 'started'; players: LobbyPlayer[] },
  ) => api<LobbyView>(lobby(code), 'PUT', { hostKey, ...data }),
  /** A one-time secret for one player's own QR code (`id` reuses a player already in the lobby). */
  seat: (code: string, hostKey: string, data: { id?: string; name: string; emoji: string }) =>
    api<{ player: LobbyPlayer; claim: string }>(`${lobby(code)}/seats`, 'POST', { hostKey, ...data }),
  kick: (code: string, hostKey: string, id: string) =>
    api<{ ok: true }>(`${lobby(code)}/players/${id}`, 'DELETE', { hostKey }),

  // Phone
  /** Become the player whose QR code this phone scanned. */
  claim: (code: string, claim: string) =>
    api<{ player: LobbyPlayer; token: string }>(`${lobby(code)}/claim`, 'POST', { claim }),
  join: (code: string, name: string, emoji: string, personId?: string) =>
    api<{ player: LobbyPlayer; token: string }>(`${lobby(code)}/players`, 'POST', { name, emoji, personId }),
  update: (code: string, id: string, token: string, changes: { name?: string; emoji?: string }) =>
    api<LobbyPlayer>(`${lobby(code)}/players/${id}`, 'PATCH', { token, ...changes }),
  leave: (code: string, id: string, token: string) =>
    api<{ ok: true }>(`${lobby(code)}/players/${id}`, 'DELETE', { token }),
  submitScore: (
    code: string,
    id: string,
    token: string,
    score: {
      gameId: string;
      round: number;
      value: number;
      special: boolean;
      phase?: 'bid' | 'play';
      bid?: number;
      tricks?: number;
      captures?: Record<string, number>;
    },
  ) => api<{ ok: true }>(`${lobby(code)}/players/${id}/score`, 'PUT', { token, ...score }),
};

/**
 * Live lobby updates. `onview` runs with the whole lobby on connect and on every change.
 * After a dropped connection it keeps trying, including when the server has restarted and
 * doesn't know the lobby yet (the browser alone would give up then); `onerror` runs each time.
 */
export function watchLobby(
  code: string,
  onview: (view: LobbyView) => void,
  onerror?: () => void,
  /** The host passes its key to also receive the scores phones send. */
  hostKey?: string,
): () => void {
  const query = hostKey ? `?hostKey=${encodeURIComponent(hostKey)}` : '';
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const open = () => {
    source = new EventSource(`${lobby(code)}/events${query}`);
    source.onmessage = (e) => onview(JSON.parse(e.data) as LobbyView);
    source.onerror = () => {
      onerror?.();
      // CLOSED means the browser gave up (e.g. a 404 after a restart): try again shortly.
      if (!stopped && source?.readyState === EventSource.CLOSED) retry = setTimeout(open, 3000);
    };
  };
  open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    source?.close();
  };
}

/**
 * The link phones open. When the host's page was itself opened by network
 * address, that address works; on localhost, use this computer's Wi-Fi address.
 */
export function joinUrl(code: string, network: LobbyNetwork | null, loc: Location = location): string | null {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname);
  if (!local) return `${loc.origin}/join/${code}`;
  const address = network?.addresses[0];
  return address ? `${loc.protocol}//${address}:${network!.port || loc.port}/join/${code}` : null;
}
