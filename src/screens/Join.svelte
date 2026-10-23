<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Avatar from '../components/Avatar.svelte';
  import CalloutToast from '../components/CalloutToast.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import LiveScoreboard from '../components/LiveScoreboard.svelte';
  import PhoneRound from '../components/PhoneRound.svelte';
  import PhoneTricks from '../components/PhoneTricks.svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import { randomEmoji } from '../lib/emoji';
  import { loadProfile, personId, saveProfile } from '../lib/profile';
  import { lobbyApi, watchLobby } from '../lib/lobbyClient';
  import type { LobbyView } from '../lib/lobbyTypes';

  /** The phone side of a lobby: enter a name, pick an emoji, wait for the host to start. */
  interface Props {
    /** From the link, e.g. /join/QKZD. Empty when the player typed the bare /join address. */
    initialCode?: string;
  }

  let { initialCode = '' }: Props = $props();

  interface Me {
    id: string;
    token: string;
  }

  // The link's code is read once; after that the player can type another.
  const fromLink = () => initialCode.toUpperCase();
  let code = $state(fromLink());
  let codeInput = $state(fromLink());
  let view = $state<LobbyView | null>(null);
  let me = $state<Me | null>(null);
  let editing = $state(false);
  // Returning players: this phone remembers who it last played as.
  const remembered = loadProfile();
  let name = $state(remembered?.name ?? '');
  let emoji = $state<string | undefined>(remembered?.emoji);
  /** Set when their usual avatar was taken by someone else in this game. */
  let usualTaken = $state<string | null>(null);
  /** The avatar check runs once, on arrival; later updates include this phone's own join. */
  let avatarChecked = false;
  let error = $state('');
  let busy = $state(false);
  let reconnecting = $state(false);
  /** During the game: send a score, or look at the standings. */
  let tab = $state<'round' | 'standings'>('round');
  let stopWatching: (() => void) | null = null;

  const mine = $derived(me && view ? view.players.find((p) => p.id === me!.id) : undefined);
  const mySeat = $derived(mine && view ? view.players.indexOf(mine) : 0);
  const taken = $derived(new Set(view?.players.filter((p) => p.id !== me?.id).map((p) => p.emoji) ?? []));

  const phase = $derived.by(() => {
    if (!view) return 'code';
    if (view.status === 'closed') return 'closed';
    if (view.status === 'started') return mine ? 'started' : 'too-late';
    if (me && !mine) return 'removed';
    if (mine && !editing) return 'waiting';
    return 'profile';
  });

  onMount(() => {
    if (code) connect(code);
  });
  onDestroy(() => stopWatching?.());

  const storageKey = (c: string) => `scorepad:join:${c}`;

  function loadMe(c: string): Me | null {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(c)) ?? 'null');
      return saved?.id && saved?.token ? saved : null;
    } catch {
      return null;
    }
  }

  function saveMe(c: string, value: Me | null) {
    try {
      if (value) localStorage.setItem(storageKey(c), JSON.stringify(value));
      else localStorage.removeItem(storageKey(c));
    } catch {
      // Private mode: the player just can't reconnect after a refresh.
    }
  }

  async function connect(c: string) {
    error = '';
    busy = true;
    try {
      // A plain fetch first, so a wrong code gets the server's message.
      view = await lobbyApi.view(c);
      code = view.code;
      me = loadMe(code);
      history.replaceState(null, '', `/join/${code}`);
      stopWatching?.();
      stopWatching = watchLobby(
        code,
        (v) => {
          reconnecting = false;
          view = v;
          if (!avatarChecked) {
            avatarChecked = true;
            const others = v.players.filter((p) => p.id !== me?.id).map((p) => p.emoji);
            if (!emoji) emoji = randomEmoji(others);
            else if (!v.players.some((p) => p.id === me?.id) && others.includes(emoji)) {
              // Their usual avatar is taken in this game: offer another, and say why.
              usualTaken = emoji;
              emoji = randomEmoji(others);
            }
          }
        },
        () => (reconnecting = true),
      );
    } catch (e) {
      view = null;
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  function submitCode(e: SubmitEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (c.length === 4) connect(c);
    else error = 'Codes are 4 letters.';
  }

  async function submitProfile(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim() || !emoji || busy) return;
    error = '';
    busy = true;
    try {
      if (mine && me) {
        const sent = { name, emoji };
        await lobbyApi.update(code, me.id, me.token, sent);
        saveProfile(sent);
        editing = false;
      } else {
        // Save exactly what was sent; the screen may update while the request is in flight.
        const sent = { name, emoji };
        const res = await lobbyApi.join(code, sent.name, sent.emoji, personId() ?? undefined);
        me = { id: res.player.id, token: res.token };
        saveMe(code, me);
        saveProfile(sent);
      }
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  function edit() {
    if (!mine) return;
    name = mine.name;
    emoji = mine.emoji;
    error = '';
    editing = true;
  }

  async function leave() {
    if (!me) return;
    const was = me;
    me = null;
    saveMe(code, null);
    editing = false;
    await lobbyApi.leave(code, was.id, was.token).catch(() => {});
  }

  function joinAgain() {
    me = null;
    saveMe(code, null);
    error = '';
  }
</script>

<main class="screen join">
  <div class="top-row">
    {#if !view?.scoreboard || (phase !== 'started' && phase !== 'too-late')}
      <p class="eyebrow">Scorepad{view ? ` · ${view.gameName}` : ''}</p>
    {:else}
      <span></span>
    {/if}
    <ThemePicker />
  </div>

  {#if reconnecting}
    <p class="banner" role="status">Reconnecting to the host…</p>
  {/if}

  {#if phase === 'started' && view?.scoreboard}
    {@const c = view.scoreboard.callout}
    <CalloutToast callout={c} player={c ? view.scoreboard.rows.find((r) => r.seat === c.seat) : null} />
  {/if}

  {#if phase === 'code'}
    <h1 class="title">Join a game</h1>
    <form class="stack" onsubmit={submitCode}>
      <label class="section-label" for="code">Game code</label>
      <input
        id="code"
        class="text-input code-input"
        type="text"
        maxlength="4"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        placeholder="ABCD"
        bind:value={codeInput}
      />
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>Continue</button>
    </form>
    <p class="muted">The code is on the host’s screen.</p>
  {:else if phase === 'profile'}
    <h1 class="title">
      {editing ? 'Change your look' : remembered ? `Welcome back, ${remembered.name}!` : 'Who are you?'}
    </h1>
    {#if !editing && remembered}
      <p class="muted welcome">Your name and avatar are filled in from last time. Change anything, or just join.</p>
    {/if}
    {#if !editing && usualTaken}
      <p class="muted welcome">Someone here already has {usualTaken}, so you’ve got a new one for this game.</p>
    {/if}
    <form class="stack" onsubmit={submitProfile}>
      <div class="preview">
        <Avatar name={name} seat={mine ? mySeat : (view?.players.length ?? 0)} {emoji} size={88} />
      </div>
      <label class="section-label" for="name">Your name</label>
      <input
        id="name"
        class="text-input"
        type="text"
        maxlength="20"
        autocomplete="nickname"
        autocapitalize="words"
        enterkeyhint="done"
        placeholder="Name"
        bind:value={name}
      />
      <h2 class="section-label">Pick an avatar</h2>
      <EmojiPicker value={emoji} {taken} onpick={(e) => (emoji = e)} />
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <button type="submit" class="btn btn-primary btn-block" disabled={busy || !name.trim() || !emoji}>
          {editing ? 'Save' : 'Join game'}
        </button>
        {#if editing}
          <button type="button" class="btn btn-ghost btn-block" onclick={() => (editing = false)}>Cancel</button>
        {/if}
      </div>
    </form>
  {:else if phase === 'waiting' && mine && view}
    <section class="hero" aria-live="polite">
      <Avatar name={mine.name} seat={mySeat} emoji={mine.emoji} size={120} />
      <h1>You’re in, {mine.name}!</h1>
      <p class="muted">Waiting for the host to start<span class="dots" aria-hidden="true"></span></p>
    </section>
    <h2 class="section-label">Here so far · {view.players.length}</h2>
    <ul class="crowd">
      {#each view.players as p, i (p.id)}
        <li class:me={p.id === mine.id}>
          <Avatar name={p.name} seat={i} emoji={p.emoji} size={32} />
          <span>{p.name}</span>
        </li>
      {/each}
    </ul>
    <div class="actions">
      <button type="button" class="btn btn-block" onclick={edit}>Change name or avatar</button>
      <button type="button" class="btn btn-ghost btn-block" onclick={leave}>Leave game</button>
    </div>
  {:else if phase === 'started' && mine && me && view?.round}
    <div class="tabs" role="tablist" aria-label="View">
      <button type="button" role="tab" aria-selected={tab === 'round'} onclick={() => (tab = 'round')}>Round</button>
      <button type="button" role="tab" aria-selected={tab === 'standings'} onclick={() => (tab = 'standings')}>Standings</button>
    </div>
    {#if tab === 'round'}
      {#if view.round.trick}
        <PhoneTricks {code} {me} round={view.round} submitted={view.submitted.includes(me.id)} scoreboard={view.scoreboard} />
      {:else}
        <PhoneRound {code} {me} round={view.round} submitted={view.submitted.includes(me.id)} scoreboard={view.scoreboard} />
      {/if}
    {:else if view.scoreboard}
      <LiveScoreboard board={view.scoreboard} meId={mine.id} />
    {/if}
  {:else if phase === 'started' && mine && view?.scoreboard}
    <LiveScoreboard board={view.scoreboard} meId={mine.id} />
  {:else if phase === 'started' && mine}
    <section class="hero" aria-live="polite">
      <Avatar name={mine.name} seat={mySeat} emoji={mine.emoji} size={120} />
      <h1>Game on!</h1>
      <p class="muted">Scores are kept on the host’s screen. Good luck, {mine.name}.</p>
    </section>
  {:else if phase === 'removed'}
    <section class="hero" aria-live="polite">
      <h1>You’re not in this game</h1>
      <p class="muted">The host removed you, or you left.</p>
    </section>
    <div class="actions">
      <button type="button" class="btn btn-primary btn-block" onclick={joinAgain}>Join again</button>
    </div>
  {:else if phase === 'too-late'}
    <section class="hero" aria-live="polite">
      <h1>This game already started</h1>
      <p class="muted">Ask the host to add you next game. You can follow the scores here.</p>
    </section>
    {#if view?.scoreboard}<LiveScoreboard board={view.scoreboard} meId={null} />{/if}
  {:else if phase === 'closed'}
    <section class="hero" aria-live="polite">
      <h1>The host cancelled this game</h1>
      <p class="muted">Ask them for a new code.</p>
    </section>
  {/if}
</main>

<style>
  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .top-row .eyebrow {
    margin: 0;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 16px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .tabs button {
    flex: 1;
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font-weight: 700;
    cursor: pointer;
  }
  .tabs button[aria-selected='true'] {
    background: var(--amber);
    color: var(--on-amber);
  }
  .welcome {
    margin: -8px 0 8px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .stack .section-label:first-child,
  .stack .preview + .section-label {
    margin-top: 8px;
  }
  .code-input {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: 0.3em;
    text-align: center;
    text-transform: uppercase;
  }
  .preview {
    display: flex;
    justify-content: center;
  }
  .error {
    margin: 12px 0 0;
    color: var(--coral);
    font-weight: 650;
  }
  .muted {
    color: var(--muted);
  }
  .banner {
    margin: 0 0 12px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--amber);
    font-weight: 650;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 0 8px;
    text-align: center;
  }
  .hero h1 {
    margin: 8px 0 0;
    font-size: 30px;
    line-height: 1.1;
  }
  .hero p {
    margin: 0;
  }
  .dots::after {
    content: '…';
    animation: blink 1.4s steps(1) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dots::after {
      animation: none;
    }
  }
  .crowd {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .crowd li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 4px 4px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-weight: 650;
  }
  .crowd li.me {
    border-color: var(--amber);
  }
</style>
