<script lang="ts">
  import { onMount } from 'svelte';
  import { getGame } from './games';
  import { deleteSession, finishedSessions, inProgressSessions, saveSession } from './lib/db';
  import { buildLiveRound } from './lib/liveRound';
  import { lobbyApi, watchLobby } from './lib/lobbyClient';
  import type { LobbyView } from './lib/lobbyTypes';
  import { buildScoreboard } from './lib/scoreboard';
  import { createSession, rematch } from './lib/session';
  import type { GameModule, PlayerInput, Session } from './lib/types';
  import Library from './screens/Library.svelte';
  import Play from './screens/Play.svelte';
  import PlayerSetup from './screens/PlayerSetup.svelte';
  import Results from './screens/Results.svelte';

  type Screen = { name: 'library' } | { name: 'setup'; game: GameModule } | { name: 'play' } | { name: 'results' };

  let screen = $state<Screen>({ name: 'library' });
  /** The game being played or just finished. */
  let session = $state<Session | null>(null);
  const game = $derived(session ? getGame(session.gameId) : undefined);

  let loaded = $state(false);
  let saveFailed = $state(false);
  let inProgress = $state<Session[]>([]);
  let recent = $state<Session[]>([]);

  onMount(async () => {
    // Pick up where we left off: reopen the newest unfinished game.
    try {
      await refreshLists();
      const resume = inProgress[0];
      if (resume && getGame(resume.gameId)) open(resume);
    } catch {
      saveFailed = true;
    }
    loaded = true;
  });

  async function refreshLists() {
    [inProgress, recent] = await Promise.all([inProgressSessions(), finishedSessions()]);
  }

  /** Every session change is saved straight away, and sent to phones when players joined by phone. */
  function persist(s: Session) {
    session = s;
    saveSession(s).catch(() => (saveFailed = true));
    publish(s);
  }

  let lastPublished = '';
  /** Send the live scoreboard to the game's phone lobby, only when the standings changed. */
  function publish(s: Session) {
    const g = getGame(s.gameId);
    if (!s.lobby || !g) return;
    const live = { scoreboard: buildScoreboard(g, s), round: buildLiveRound(g, s) };
    const key = `${s.lobby.code}:${JSON.stringify(live)}`;
    if (key === lastPublished) return;
    lastPublished = key;
    // A lobby lost to a server restart just stops updating; scoring carries on.
    lobbyApi.publish(s.lobby.code, s.lobby.hostKey, live).catch(() => (lastPublished = ''));
  }

  // While a phone game is open, listen for the scores phones send.
  // Keyed on the lobby (a string), so saving every keystroke doesn't reconnect.
  const lobbyKey = $derived(session?.lobby ? `${session.lobby.code} ${session.lobby.hostKey}` : '');
  let hostLobby = $state<LobbyView | null>(null);
  $effect(() => {
    if (!lobbyKey) return;
    const [code, hostKey] = lobbyKey.split(' ');
    const stop = watchLobby(code, (v) => (hostLobby = v), undefined, hostKey);
    return () => {
      stop();
      hostLobby = null;
    };
  });

  function sendBackToPhone(lobbyId: string) {
    const link = session?.lobby;
    if (link) lobbyApi.sendBack(link.code, link.hostKey, lobbyId).catch(() => {});
  }

  function goLibrary() {
    screen = { name: 'library' };
    refreshLists().catch(() => (saveFailed = true));
  }

  function open(s: Session) {
    session = s;
    publish(s);
    screen = s.finishedAt ? { name: 'results' } : { name: 'play' };
  }

  function start(
    g: GameModule,
    players: PlayerInput[],
    options: Record<string, boolean>,
    lobby?: { code: string; hostKey: string },
  ) {
    const s = createSession(g, players, options);
    persist(lobby ? { ...s, lobby } : s);
    screen = { name: 'play' };
  }

  function change(next: Session) {
    const justFinished = !session?.finishedAt && next.finishedAt;
    persist(next);
    if (justFinished) screen = { name: 'results' };
  }

  async function remove(s: Session) {
    if (session?.id === s.id) session = null;
    await deleteSession(s.id).catch(() => (saveFailed = true));
    await refreshLists().catch(() => (saveFailed = true));
  }

  /** The most recent game of this type, to prefill player names and options. */
  function previousFor(g: GameModule): Session | undefined {
    return [session, ...inProgress, ...recent].find((s) => s?.gameId === g.id) ?? undefined;
  }
</script>

{#if !loaded}
  <!-- Blank while IndexedDB loads (a few ms) so the library doesn't flash before a resumed game. -->
{:else if screen.name === 'library'}
  <Library {inProgress} {recent} {saveFailed} onpick={(g) => (screen = { name: 'setup', game: g })} onopen={open} ondelete={remove} />
{:else if screen.name === 'setup'}
  {@const g = screen.game}
  {@const previous = previousFor(g)}
  <PlayerSetup
    game={g}
    initialPlayers={previous?.players.map((p) => ({ name: p.name, emoji: p.emoji }))}
    initialOptions={previous?.options}
    onstart={(players, options, lobby) => start(g, players, options, lobby)}
    onback={goLibrary}
  />
{:else if session && game && screen.name === 'play'}
  <Play
    {game}
    {session}
    onchange={change}
    onexit={goLibrary}
    onresults={() => (screen = { name: 'results' })}
    submissions={hostLobby?.submissions}
    onsendback={sendBackToPhone}
  />
{:else if session && game && screen.name === 'results'}
  <Results
    {game}
    {session}
    onrematch={() => {
      persist(rematch(session!));
      screen = { name: 'play' };
    }}
    onnewgame={goLibrary}
    onedit={() => (screen = { name: 'play' })}
  />
{/if}
