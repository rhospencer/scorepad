import type { LiveRound, LobbyNetwork, LobbyPlayer, LobbyView, Scoreboard } from './lobbyTypes';

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
    throw new Error('Can’t reach the host. Are you on the same Wi-Fi?');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
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
  kick: (code: string, hostKey: string, id: string) =>
    api<{ ok: true }>(`${lobby(code)}/players/${id}`, 'DELETE', { hostKey }),

  // Phone
  join: (code: string, name: string, emoji: string) =>
    api<{ player: LobbyPlayer; token: string }>(`${lobby(code)}/players`, 'POST', { name, emoji }),
  update: (code: string, id: string, token: string, changes: { name?: string; emoji?: string }) =>
    api<LobbyPlayer>(`${lobby(code)}/players/${id}`, 'PATCH', { token, ...changes }),
  leave: (code: string, id: string, token: string) =>
    api<{ ok: true }>(`${lobby(code)}/players/${id}`, 'DELETE', { token }),
  submitScore: (
    code: string,
    id: string,
    token: string,
    score: { gameId: string; round: number; value: number; special: boolean },
  ) => api<{ ok: true }>(`${lobby(code)}/players/${id}/score`, 'PUT', { token, ...score }),
};

/**
 * Live lobby updates. `onview` runs with the whole lobby on connect and on
 * every change; the browser reconnects by itself after a dropped connection.
 */
export function watchLobby(
  code: string,
  onview: (view: LobbyView) => void,
  onerror?: () => void,
  /** The host passes its key to also receive the scores phones send. */
  hostKey?: string,
): () => void {
  const query = hostKey ? `?hostKey=${encodeURIComponent(hostKey)}` : '';
  const source = new EventSource(`${lobby(code)}/events${query}`);
  source.onmessage = (e) => onview(JSON.parse(e.data) as LobbyView);
  source.onerror = () => onerror?.();
  return () => source.close();
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
