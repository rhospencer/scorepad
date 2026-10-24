<script lang="ts">
  import { onMount } from 'svelte';
  import { getSessionGame } from './games';
  import { blankSpec, buildCustomGame, copySpec } from './lib/customGame';
  import {
    allPeople,
    customGames,
    deleteCustomGame,
    deleteSession,
    finishedSessions,
    inProgressSessions,
    saveCustomGame,
    savePeople,
    saveSession,
  } from './lib/db';
  import { buildLiveRound } from './lib/liveRound';
  import { lobbyApi, watchLobby } from './lib/lobbyClient';
  import type { LobbyView } from './lib/lobbyTypes';
  import { peopleAfterGame } from './lib/people';
  import { buildScoreboard } from './lib/scoreboard';
  import { createSession, rematch } from './lib/session';
  import type { CustomGameSpec, GameModule, Options, Person, PlayerInput, Session } from './lib/types';
  import GameBuilder from './screens/GameBuilder.svelte';
  import Library from './screens/Library.svelte';
  import Play from './screens/Play.svelte';
  import Players from './screens/Players.svelte';
  import PlayerSetup from './screens/PlayerSetup.svelte';
  import Results from './screens/Results.svelte';

  type Screen =
    | { name: 'library' }
    | { name: 'setup'; game: GameModule }
    | { name: 'play' }
    | { name: 'results' }
    | { name: 'players'; sessions: Session[] }
    | { name: 'builder'; spec: CustomGameSpec; existing: boolean };

  let screen = $state<Screen>({ name: 'library' });
  /** The game being played or just finished. */
  let session = $state<Session | null>(null);
  // With the session's setup options applied (e.g. Kombio "after 5 rounds").
  const game = $derived(session ? getSessionGame(session) : undefined);

  let loaded = $state(false);
  let saveFailed = $state(false);
  let inProgress = $state<Session[]>([]);
  let recent = $state<Session[]>([]);
  /** Games built in the app. */
  let customs = $state<CustomGameSpec[]>([]);
  /** Saved players: quick picks in setup, and merges for player records. */
  let people = $state<Person[]>([]);
  const customModules = $derived(customs.map(buildCustomGame));
  /** The library selects this after a save, so the new game is in view. */
  let justSaved = $state<string | null>(null);

  onMount(async () => {
    // Pick up where we left off: reopen the newest unfinished game.
    try {
      await refreshLists();
      const resume = inProgress[0];
      if (resume && getSessionGame(resume)) open(resume);
    } catch {
      saveFailed = true;
    }
    loaded = true;
  });

  async function refreshLists() {
    [inProgress, recent, customs, people] = await Promise.all([
      inProgressSessions(),
      finishedSessions(),
      customGames(),
      allPeople(),
    ]);
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
    const g = getSessionGame(s);
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

  async function showPlayers() {
    const sessions = await finishedSessions(Infinity).catch(() => recent);
    screen = { name: 'players', sessions };
  }

  /** Remember who played: new saved players, and fresh names, emoji and dates. */
  async function rememberPlayers(s: Session) {
    const updates = peopleAfterGame(s.players, people);
    await savePeople(updates).catch(() => (saveFailed = true));
    const fresh = new Map(updates.map((p) => [p.id, p]));
    people = [...people.filter((p) => !fresh.has(p.id)), ...updates];
  }

  async function setMerge(id: string, into: string | undefined) {
    const p = people.find((x) => x.id === id);
    if (!p) return;
    const next: Person = { ...p, mergedInto: into };
    if (!into) delete next.mergedInto;
    await savePeople([next]).catch(() => (saveFailed = true));
    people = people.map((x) => (x.id === id ? next : x));
  }

  function open(s: Session) {
    session = s;
    publish(s);
    screen = s.finishedAt ? { name: 'results' } : { name: 'play' };
  }

  function start(
    g: GameModule,
    players: PlayerInput[],
    options: Options,
    lobby?: { code: string; hostKey: string },
  ) {
    const s = createSession(g, players, options);
    persist(lobby ? { ...s, lobby } : s);
    rememberPlayers(s);
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

  async function saveBuilt(spec: CustomGameSpec) {
    await saveCustomGame(spec).catch(() => (saveFailed = true));
    justSaved = spec.id;
    goLibrary();
  }

  async function removeBuilt(id: string) {
    await deleteCustomGame(id).catch(() => (saveFailed = true));
    goLibrary();
  }

  /** The most recent game of this type, to prefill player names and options. */
  function previousFor(g: GameModule): Session | undefined {
    return [session, ...inProgress, ...recent].find((s) => s?.gameId === g.id) ?? undefined;
  }
</script>

{#if !loaded}
  <!-- Blank while IndexedDB loads (a few ms) so the library doesn't flash before a resumed game. -->
{:else if screen.name === 'library'}
  <Library
    {inProgress}
    {recent}
    {saveFailed}
    customGames={customModules}
    initialSelected={justSaved}
    onpick={(g) => (screen = { name: 'setup', game: g })}
    onopen={open}
    ondelete={remove}
    oncreate={() => (screen = { name: 'builder', spec: blankSpec(), existing: false })}
    onedit={(g) => g.custom && (screen = { name: 'builder', spec: g.custom, existing: true })}
    onremovegame={(g) => removeBuilt(g.id)}
    onplayers={showPlayers}
    onrestored={() => refreshLists().catch(() => (saveFailed = true))}
  />
{:else if screen.name === 'players'}
  <Players
    sessions={screen.sessions}
    {people}
    onback={goLibrary}
    onmerge={(id, into) => setMerge(id, into)}
    onsplit={(id) => setMerge(id, undefined)}
  />
{:else if screen.name === 'builder'}
  {@const b = screen}
  {#key b.spec.id}
    <GameBuilder
      initial={b.spec}
      existing={b.existing}
      onsave={saveBuilt}
      oncancel={goLibrary}
      oncopy={() => (screen = { name: 'builder', spec: copySpec(b.spec), existing: false })}
      ondelete={() => removeBuilt(b.spec.id)}
    />
  {/key}
{:else if screen.name === 'setup'}
  {@const g = screen.game}
  {@const previous = previousFor(g)}
  <PlayerSetup
    game={g}
    initialPlayers={previous?.players.map((p) => ({ name: p.name, emoji: p.emoji, personId: p.personId }))}
    {people}
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
      const next = rematch(session!);
      persist(next);
      rememberPlayers(next);
      screen = { name: 'play' };
    }}
    onnewgame={goLibrary}
    onedit={() => (screen = { name: 'play' })}
  />
{/if}
