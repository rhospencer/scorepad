<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import Avatar from '../components/Avatar.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import InvitePanel from '../components/InvitePanel.svelte';
  import { joinUrl, lobbyApi, watchLobby } from '../lib/lobbyClient';
  import type { LobbyNetwork, LobbyView } from '../lib/lobbyTypes';
  import { defaultOptions, MAX_PLAYERS } from '../lib/session';
  import { viewport } from '../lib/viewport.svelte';
  import type { GameModule, Options } from '../lib/types';

  interface StartingPlayer {
    name: string;
    emoji?: string;
    lobbyId?: string;
  }

  interface Props {
    game: GameModule;
    /** Players to start with, e.g. from the last game played. */
    initialPlayers?: StartingPlayer[];
    initialOptions?: Options;
    /** `lobby` is set when players joined by phone; the game then publishes live scores to it. */
    onstart: (
      players: StartingPlayer[],
      options: Options,
      lobby?: { code: string; hostKey: string },
    ) => void;
    onback: () => void;
  }

  let { game, initialPlayers = [], initialOptions, onstart, onback }: Props = $props();

  const min = $derived(game.players.min);
  /** The game's suggested size; going past it is allowed. */
  const suggested = $derived(game.players.max);
  const max = MAX_PLAYERS;

  interface Row {
    key: number;
    name: string;
    emoji?: string;
    /** Set when the player joined from their phone; their name and emoji come from the lobby. */
    remoteId?: string;
  }

  function startingRows(): Row[] {
    const rows: Row[] = initialPlayers.slice(0, max).map((p) => ({ key: nextKey++, name: p.name, emoji: p.emoji }));
    while (rows.length < min) rows.push({ key: nextKey++, name: '' });
    return rows;
  }

  function startingOptions(): Options {
    return { ...defaultOptions(game), ...initialOptions };
  }

  // The form starts from the props once; edits stay local until Start.
  // Each row gets a stable key so removing a player doesn't shuffle the inputs.
  let nextKey = 0;
  let rows = $state<Row[]>(startingRows());
  let options = $state(startingOptions());
  let list: HTMLOListElement;
  /** Key of the row whose emoji picker is open. */
  let picking = $state<number | null>(null);

  const duplicates = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const n = r.name.trim().toLowerCase();
      if (n) seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, c]) => c > 1).map(([n]) => n));
  });
  const usedEmoji = $derived(new Set(rows.map((r) => r.emoji).filter((e): e is string => !!e)));

  // ---- Inviting players by phone ----
  let invite = $state<{ code: string; hostKey: string } | null>(null);
  let lobby = $state<LobbyView | null>(null);
  let network = $state<LobbyNetwork | null>(null);
  let inviteError = $state('');
  let opening = $state(false);
  let stopWatching: (() => void) | null = null;

  /** Seats phones may take: everything not used by a name typed on this screen. */
  const openSlots = $derived(max - rows.filter((r) => !r.remoteId && r.name.trim()).length);
  const overSuggested = $derived(rows.length > suggested);
  const remoteCount = $derived(rows.filter((r) => r.remoteId).length);

  // Keep the lobby's seat count in step as the host types names in.
  $effect(() => {
    const slots = openSlots;
    if (invite && lobby && lobby.openSlots !== slots) {
      lobbyApi.setOpenSlots(invite.code, invite.hostKey, slots).catch(() => {});
    }
  });

  onDestroy(() => stopWatching?.());

  async function openInvite() {
    inviteError = '';
    opening = true;
    try {
      const [created, net] = await Promise.all([lobbyApi.create(game.name, openSlots), lobbyApi.network()]);
      invite = created;
      network = net;
      stopWatching = watchLobby(created.code, syncFromLobby);
    } catch (e) {
      inviteError = `Couldn’t start inviting: ${(e as Error).message}`;
    } finally {
      opening = false;
    }
  }

  /** Stop inviting. Phones that joined stay in the player list as plain names. */
  function closeInvite() {
    if (!invite) return;
    lobbyApi.close(invite.code, invite.hostKey).catch(() => {});
    stopWatching?.();
    stopWatching = null;
    invite = null;
    lobby = null;
    for (const r of rows) delete r.remoteId;
  }

  /** Mirror the lobby into the player list: new phones fill blank rows first. */
  function syncFromLobby(view: LobbyView) {
    lobby = view;
    const ids = new Set(view.players.map((p) => p.id));
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.remoteId && !ids.has(r.remoteId)) dropRow(i);
    }
    for (const p of view.players) {
      const row = rows.find((r) => r.remoteId === p.id);
      if (row) {
        row.name = p.name;
        row.emoji = p.emoji;
        continue;
      }
      const blank = rows.find((r) => !r.remoteId && !r.name.trim());
      if (blank) Object.assign(blank, { name: p.name, emoji: p.emoji, remoteId: p.id });
      else if (rows.length < max) rows.push({ key: nextKey++, name: p.name, emoji: p.emoji, remoteId: p.id });
    }
  }

  // ---- Editing the list ----
  async function addPlayer() {
    if (rows.length >= max) return;
    picking = null;
    rows.push({ key: nextKey++, name: '' });
    await tick();
    list.querySelector<HTMLInputElement>('li:last-child input')?.focus();
  }

  /** Remove a row, or blank it when the game needs at least this many players. */
  function dropRow(i: number) {
    if (picking === rows[i].key) picking = null;
    if (rows.length > min) rows.splice(i, 1);
    else rows[i] = { key: nextKey++, name: '' };
  }

  function removePlayer(i: number) {
    const r = rows[i];
    if (r.remoteId && invite) lobbyApi.kick(invite.code, invite.hostKey, r.remoteId).catch(() => {});
    dropRow(i);
  }

  /** Enter moves to the next name instead of starting the game. */
  function nextOnEnter(e: KeyboardEvent, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = list.querySelectorAll<HTMLInputElement>('input.name-input');
    if (i + 1 < inputs.length) inputs[i + 1].focus();
    else (e.currentTarget as HTMLInputElement).blur();
  }

  async function start(e: SubmitEvent) {
    e.preventDefault();
    // With nobody joined by phone there's nothing to publish to.
    const lobbyLink = invite && remoteCount > 0 ? { ...invite } : undefined;
    if (invite && lobbyLink) {
      // Tell the phones the game is on, then stop listening.
      await lobbyApi.start(invite.code, invite.hostKey).catch(() => {});
      stopWatching?.();
    } else closeInvite();
    onstart(
      rows.map((r) => ({ name: r.name.trim(), emoji: r.emoji, lobbyId: r.remoteId })),
      { ...options },
      lobbyLink,
    );
  }

  function back() {
    closeInvite();
    onback();
  }
</script>

{#snippet inviteArea()}
  {#if invite}
    <InvitePanel
      code={invite.code}
      url={joinUrl(invite.code, network)}
      joined={remoteCount}
      openSlots={lobby?.openSlots ?? openSlots}
      onclose={closeInvite}
      large={viewport.wide}
      joinedPlayers={rows.flatMap((r, i) => (r.remoteId ? [{ name: r.name, emoji: r.emoji, seat: i }] : []))}
    />
  {:else}
    {#if viewport.wide}
      <div class="invite-cta">
        <h2>Play from phones</h2>
        <p>Show a QR code. Players scan it, pick a name and an emoji, and send their own scores each round.</p>
      </div>
    {/if}
    <button type="button" class="btn btn-block invite-btn" disabled={opening} onclick={openInvite}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
      Invite players by phone
    </button>
    {#if inviteError}<p class="hint warn" role="alert">{inviteError}</p>{/if}
  {/if}

{/snippet}

<form class="screen wide" onsubmit={start}>
  <div class="top-bar">
    <button type="button" class="icon-btn" aria-label="Back to games" onclick={back}>←</button>
  </div>

  <p class="eyebrow">{game.name}</p>
  <h1 class="title">Who's playing?</h1>

  <div class="layout" class:split={viewport.wide}>
  <div class="left">
  {#if !viewport.wide}{@render inviteArea()}{/if}

  <ol class="players" bind:this={list}>
    {#each rows as row, i (row.key)}
      <li>
        {#if row.remoteId}
          <span class="avatar-slot"><Avatar name={row.name} seat={i} emoji={row.emoji} size={36} /></span>
        {:else}
          <button
            type="button"
            class="avatar-slot avatar-btn"
            aria-label="Choose an avatar for player {i + 1}"
            aria-expanded={picking === row.key}
            onclick={() => (picking = picking === row.key ? null : row.key)}
          >
            <Avatar name={row.name} seat={i} emoji={row.emoji} size={36} />
          </button>
        {/if}
        <label class="visually-hidden" for="player-{row.key}">Player {i + 1} name</label>
        <input
          id="player-{row.key}"
          class="text-input name-input"
          class:dupe={duplicates.has(row.name.trim().toLowerCase())}
          class:remote={row.remoteId}
          type="text"
          maxlength="20"
          autocomplete="off"
          autocapitalize="words"
          enterkeyhint="next"
          placeholder="Player {i + 1}"
          readonly={!!row.remoteId}
          aria-describedby={row.remoteId ? `phone-${row.key}` : undefined}
          bind:value={row.name}
          onkeydown={(e) => nextOnEnter(e, i)}
        />
        {#if row.remoteId}
          <span class="phone-tag" id="phone-{row.key}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
            <span class="visually-hidden">Joined by phone</span>
          </span>
        {/if}
        <button
          type="button"
          class="icon-btn"
          aria-label={row.remoteId ? `Remove ${row.name}` : `Remove player ${i + 1}`}
          disabled={rows.length <= min && !row.remoteId && !row.name}
          onclick={() => removePlayer(i)}>×</button
        >
        {#if picking === row.key}
          <div class="picker">
            <EmojiPicker
              value={row.emoji}
              taken={usedEmoji}
              label="Avatar for player {i + 1}"
              onpick={(e) => {
                row.emoji = e;
                picking = null;
              }}
            />
            {#if row.emoji}
              <button type="button" class="link-btn" onclick={() => { row.emoji = undefined; picking = null; }}>
                Use their initial instead
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>

  {#if duplicates.size > 0}
    <p class="hint warn">Two players share a name. That works, but the score sheet gets confusing.</p>
  {/if}

  <button type="button" class="btn btn-ghost add" disabled={rows.length >= max} onclick={addPlayer}>
    + Add player
  </button>
  <p class="hint">
    {min}–{suggested} players suggested{game.turns.type === 'dealer-rotation' ? ' · first player deals first' : ''}
  </p>
  {#if overSuggested && game.players.beyond}
    <p class="hint tip" role="status">{game.players.beyond.tip}</p>
  {/if}

  {#if game.options.length > 0}
    <h2 class="section-label">Options</h2>
    <ul class="options">
      {#each game.options as opt (opt.id)}
        <li>
          {#if opt.type === 'choice'}
            <fieldset class="choice">
              <legend>{opt.label}</legend>
              <div class="choices">
                {#each opt.choices as c (c.value)}
                  <label class="choice-item" class:on={options[opt.id] === c.value}>
                    <input type="radio" name="opt-{opt.id}" value={c.value} bind:group={options[opt.id]} />
                    <span>{c.label}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          {:else}
            <label class="toggle">
              <span>{opt.label}</span>
              <input type="checkbox" role="switch" checked={options[opt.id] === true} onchange={(e) => (options[opt.id] = e.currentTarget.checked)} />
              <span class="track" aria-hidden="true"></span>
            </label>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button type="submit" class="btn btn-primary btn-block">Start game</button>
  </div>
  </div>
  {#if viewport.wide}
    <aside class="right">{@render inviteArea()}</aside>
  {/if}
  </div>
</form>

<style>
  .players,
  .options {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* About 7 players show; past that the list scrolls so options and Start stay in view.
     The small padding keeps focus outlines from being clipped. */
  .players {
    max-height: 470px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 3px 6px 3px 3px;
    margin: -3px -6px -3px -3px;
  }
  .players li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .players .text-input {
    flex: 1;
    min-width: 0;
    width: auto;
  }
  .avatar-slot {
    width: 44px;
    height: 44px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-btn {
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }
  .avatar-btn[aria-expanded='true'] {
    outline: 2px solid var(--amber);
    outline-offset: 1px;
  }
  .remote {
    border-color: var(--teal);
  }
  .phone-tag {
    margin-left: -4px;
    color: var(--teal);
    display: inline-flex;
  }
  .picker {
    flex-basis: 100%;
    padding: 10px;
    border-radius: 16px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .link-btn {
    margin-top: 8px;
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--muted);
    font-weight: 650;
    text-decoration: underline;
    cursor: pointer;
  }
  .layout.split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  .left {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .split .left {
    max-width: 640px;
  }
  .right {
    position: sticky;
    top: 24px;
  }
  .invite-cta {
    padding: 28px;
    margin-bottom: 14px;
    border-radius: 24px;
    border: 1px dashed var(--line-strong);
  }
  .invite-cta h2 {
    margin: 0 0 6px;
    font-size: 24px;
  }
  .invite-cta p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }
  .invite-btn {
    margin-bottom: 16px;
    border-color: var(--amber);
    color: var(--amber);
  }
  .dupe {
    border-color: var(--amber);
  }
  .add {
    margin-top: 12px;
    border-style: dashed;
  }
  .hint {
    margin: 8px 0 0;
    font-size: 14px;
    color: var(--muted);
    text-align: center;
  }
  .hint.tip {
    color: var(--teal);
  }
  .hint.warn {
    color: var(--amber);
    text-align: left;
  }
  .choice {
    margin: 0;
    padding: 12px 14px 14px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .choice legend {
    padding: 0 4px;
    font-size: 14px;
    color: var(--muted);
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choice-item {
    position: relative;
    min-height: 44px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    font-weight: 650;
    cursor: pointer;
  }
  .choice-item input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .choice-item.on {
    border-color: var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
  .choice-item:has(input:focus-visible) {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .toggle {
    min-height: 60px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    cursor: pointer;
    position: relative;
  }
  .toggle input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .track {
    width: 52px;
    height: 32px;
    flex: none;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    position: relative;
    transition: background 0.15s;
  }
  .track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--muted);
    transition: transform 0.15s, background 0.15s;
  }
  .toggle input:checked + .track {
    background: var(--amber);
    border-color: var(--amber);
  }
  .toggle input:checked + .track::after {
    transform: translateX(20px);
    background: var(--on-amber);
  }
  .toggle input:focus-visible + .track {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
</style>
