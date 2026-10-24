<script lang="ts">
  import AddPlayerSheet, { type JoinRequest } from '../components/AddPlayerSheet.svelte';
  import CalloutToast from '../components/CalloutToast.svelte';
  import Avatar from '../components/Avatar.svelte';
  import InvitePanel from '../components/InvitePanel.svelte';
  import RaceButton from '../components/RaceButton.svelte';
  import { raceData } from '../lib/race';
  import BidTricks from '../surfaces/BidTricks.svelte';
  import RoundGrid from '../surfaces/RoundGrid.svelte';
  import { roundCallout } from '../lib/callout';
  import { joinUrl, lobbyApi } from '../lib/lobbyClient';
  import type { LobbyNetwork, LobbyPlayer, Submission } from '../lib/lobbyTypes';
  import type { GameModule, Session } from '../lib/types';

  interface Props {
    game: GameModule;
    session: Session;
    onchange: (session: Session) => void;
    onexit: () => void;
    onresults: () => void;
    submissions?: Record<string, Submission>;
    onsendback?: (lobbyId: string) => void;
    /** Phones asking to join (or rejoin) while the game is under way. */
    requests?: JoinRequest[];
    /** Add someone mid-game, with the starting score the host picked. */
    onaddplayer: (player: { name: string; emoji?: string; lobbyId?: string; personId?: string }, start: number) => void;
    /** A phone request is a player already in the game. */
    onlinkphone: (seat: number, request: JoinRequest) => void;
    ondecline: (lobbyId: string) => void;
    /** The game's phone lobby, opened now if the game started without one. */
    onopenlobby: () => Promise<{ code: string; hostKey: string } | null>;
    /** Who's in the phone lobby, as the host sees it (null before it loads). */
    lobbyPlayers?: LobbyPlayer[] | null;
    /** A one-time QR code for one player's own phone. */
    onseatphone: (seat: number) => Promise<{ code: string; claim: string } | null>;
  }

  let {
    game,
    session,
    onchange,
    onexit,
    onresults,
    submissions,
    onsendback,
    requests = [],
    onaddplayer,
    onlinkphone,
    ondecline,
    onopenlobby,
    lobbyPlayers = null,
    onseatphone,
  }: Props = $props();

  /**
   * Seats whose avatar offers a phone QR: players the host typed in, and spots no phone has
   * picked up yet (a QR nobody scanned, or a lobby brought back after a restart).
   */
  const phoneSeats = $derived(
    session.players.map((p) => {
      if (!p.lobbyId) return true;
      if (!lobbyPlayers) return false;
      const lp = lobbyPlayers.find((x) => x.id === p.lobbyId);
      return !lp || !!lp.waiting;
    }),
  );

  // ---- One player's own QR code ----
  let phoneFor = $state<number | null>(null);
  let phoneLink = $state<{ code: string; claim: string } | null>(null);
  let phoneError = $state('');
  let phoneDialog = $state<HTMLDialogElement>();
  const phonePlayer = $derived(phoneFor === null ? null : session.players[phoneFor]);
  /** Their phone scanned the code and picked up the spot. */
  const phoneConnected = $derived(
    !!phoneLink && !!phonePlayer?.lobbyId && !!lobbyPlayers?.some((x) => x.id === phonePlayer.lobbyId && !x.waiting),
  );
  const phoneUrl = $derived.by(() => {
    if (!phoneLink) return null;
    const base = joinUrl(phoneLink.code, network);
    return base ? `${base}?claim=${encodeURIComponent(phoneLink.claim)}` : null;
  });

  $effect(() => {
    if (!phoneDialog) return;
    if (phoneFor !== null && !phoneDialog.open) phoneDialog.showModal();
    if (phoneFor === null && phoneDialog.open) phoneDialog.close();
  });

  // Close a moment after their phone connects, so the host sees it worked.
  $effect(() => {
    if (!phoneConnected) return;
    const t = setTimeout(() => (phoneFor = null), 1500);
    return () => clearTimeout(t);
  });

  async function showPlayerQr(seat: number) {
    phoneFor = seat;
    phoneLink = null;
    phoneError = '';
    try {
      const [link, net] = await Promise.all([onseatphone(seat), network ? Promise.resolve(network) : lobbyApi.network()]);
      network = net;
      if (link) phoneLink = link;
      else phoneError = 'Couldn’t open a lobby for phones. Is the server running?';
    } catch (err) {
      phoneError = (err as Error).message || 'Couldn’t make a code. Try again.';
    }
  }

  const callout = $derived(roundCallout(game, session));

  let menuOpen = $state(false);
  /** The add-player sheet: open for the host typing someone in, or reviewing a phone. */
  let adding = $state(false);
  let reviewing = $state<JoinRequest | null>(null);
  let inviteOpen = $state(false);
  let inviteError = $state('');
  let network = $state<LobbyNetwork | null>(null);
  let inviteDialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!inviteDialog) return;
    if (inviteOpen && !inviteDialog.open) inviteDialog.showModal();
    if (!inviteOpen && inviteDialog.open) inviteDialog.close();
  });

  function addPlayer() {
    menuOpen = false;
    reviewing = null;
    adding = true;
  }

  function review(r: JoinRequest) {
    reviewing = r;
    adding = true;
  }

  function closeSheet() {
    adding = false;
    reviewing = null;
  }

  async function showInvite() {
    menuOpen = false;
    inviteError = '';
    inviteOpen = true;
    try {
      const [lobby, net] = await Promise.all([onopenlobby(), network ? Promise.resolve(network) : lobbyApi.network()]);
      network = net;
      if (!lobby) inviteError = 'Couldn’t open a lobby for phones. Is the server running?';
    } catch {
      inviteError = 'Couldn’t open a lobby for phones. Is the server running?';
    }
  }

  const link = $derived(session.lobby ? joinUrl(session.lobby.code, network) : null);
  const phones = $derived(session.players.filter((p) => p.lobbyId).length);
</script>

<CalloutToast {callout} player={callout ? session.players[callout.seat] : null} />

{#snippet tools()}
  <div class="menu-wrap">
    <button
      type="button"
      class="icon-btn"
      aria-label="Players: add someone or show the join QR"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0114 0" /><path d="M19 8v6M16 11h6" /></svg>
      {#if requests.length > 0}<span class="dot" aria-hidden="true">{requests.length}</span>{/if}
    </button>
    {#if menuOpen}
      <div class="menu" role="menu">
        <button type="button" role="menuitem" onclick={addPlayer}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add a player
        </button>
        <button type="button" role="menuitem" onclick={showInvite}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-7" /></svg>
          Show join QR
        </button>
      </div>
    {/if}
  </div>
  <RaceButton race={raceData(game, session)} />
{/snippet}

{#if menuOpen}
  <!-- Clicking anywhere else closes the menu. -->
  <button type="button" class="scrim" aria-label="Close menu" onclick={() => (menuOpen = false)}></button>
{/if}

{#if requests.length > 0 && !adding}
  <div class="requests" role="status">
    {#each requests as r (r.lobbyId)}
      <div class="request">
        <Avatar name={r.name} seat={session.players.length} emoji={r.emoji} size={32} />
        <span class="req-text"><strong>{r.name}</strong> wants to join</span>
        <button type="button" class="btn btn-primary small" onclick={() => review(r)}>Review</button>
      </div>
    {/each}
  </div>
{/if}

<!-- The game module picks the scoring surface. New surfaces plug in here. -->
<!-- Keyed on the player count too, so a player added mid-game gets a fresh round entry. -->
{#if game.surface === 'round-grid'}
  {#key `${session.id}:${session.players.length}`}
    <RoundGrid {game} {session} {onchange} {onexit} {onresults} {submissions} {onsendback} {tools} {phoneSeats} onphoneplayer={showPlayerQr} />
  {/key}
{:else if game.surface === 'bid-tricks'}
  {#key `${session.id}:${session.players.length}`}
    <BidTricks {game} {session} {onchange} {onexit} {onresults} {submissions} {onsendback} {tools} {phoneSeats} onphoneplayer={showPlayerQr} />
  {/key}
{:else}
  <main class="screen">
    <p class="eyebrow">{game.name}</p>
    <h1 class="title">Not built yet</h1>
    <p>The {game.surface} scoring screen is still on the roadmap.</p>
    <button type="button" class="btn" onclick={onexit}>Back to games</button>
  </main>
{/if}

<AddPlayerSheet
  open={adding}
  {game}
  {session}
  request={reviewing}
  onadd={(player, start) => {
    onaddplayer(player, start);
    closeSheet();
  }}
  onlink={(seat) => {
    if (reviewing) onlinkphone(seat, reviewing);
    closeSheet();
  }}
  ondecline={() => {
    if (reviewing) ondecline(reviewing.lobbyId);
    closeSheet();
  }}
  oncancel={closeSheet}
/>

<dialog
  class="invite-dialog"
  bind:this={inviteDialog}
  aria-label="Join by phone"
  oncancel={(e) => {
    e.preventDefault();
    inviteOpen = false;
  }}
  onclick={(e) => e.target === inviteDialog && (inviteOpen = false)}
>
  <div class="invite-box">
    <h2>Join by phone</h2>
    <p class="muted">
      New players scan to ask to join. Already playing? Scan too: you’ll link their phone (or move them to a new one)
      when you review the request.
    </p>
    {#if inviteError}
      <p class="error" role="alert">{inviteError}</p>
      <button type="button" class="btn btn-block" onclick={() => (inviteOpen = false)}>Close</button>
    {:else if session.lobby}
      <InvitePanel
        code={session.lobby.code}
        url={link}
        joined={phones}
        openSlots={1}
        closeLabel="Done"
        onclose={() => (inviteOpen = false)}
      />
    {:else}
      <p class="muted">Opening a lobby…</p>
    {/if}
  </div>
</dialog>

<dialog
  class="invite-dialog"
  bind:this={phoneDialog}
  aria-label="Score from a phone"
  oncancel={(e) => {
    e.preventDefault();
    phoneFor = null;
  }}
  onclick={(e) => e.target === phoneDialog && (phoneFor = null)}
>
  {#if phonePlayer}
    <div class="invite-box">
      <h2>Scan to play as {phonePlayer.name}</h2>
      <p class="muted">
        {phonePlayer.name}’s phone opens straight into the game and sends their scores from now on. Scores so far stay as
        they are. The code works once{phonePlayer.lobbyId ? '; if they had another phone, it’s let go' : ''}.
      </p>
      {#if phoneError}
        <p class="error" role="alert">{phoneError}</p>
        <button type="button" class="btn btn-block" onclick={() => (phoneFor = null)}>Close</button>
      {:else if phoneLink}
        <InvitePanel
          code={phoneLink.code}
          url={phoneUrl}
          joined={0}
          openSlots={1}
          closeLabel="Done"
          status={phoneConnected ? `✓ ${phonePlayer.name}’s phone is connected` : `Waiting for ${phonePlayer.name}’s phone…`}
          onclose={() => (phoneFor = null)}
        />
      {:else}
        <p class="muted">Making their code…</p>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .menu-wrap {
    position: relative;
  }
  .menu-wrap .icon-btn {
    position: relative;
  }
  .dot {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--amber);
    color: var(--on-amber);
    font-size: 12px;
    font-weight: 800;
    line-height: 20px;
  }
  .menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 30;
    min-width: 200px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.3);
  }
  .menu button {
    min-height: 44px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--text);
    font-size: 15px;
    font-weight: 650;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover,
  .menu button:focus-visible {
    background: var(--surface-2);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    border: 0;
    background: transparent;
    cursor: default;
  }
  .requests {
    position: fixed;
    left: 50%;
    bottom: calc(100px + env(safe-area-inset-bottom));
    translate: -50% 0;
    z-index: 35;
    width: min(420px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .request {
    padding: 8px 8px 8px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 18px;
    border: 2px solid var(--amber);
    background: var(--surface);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.3);
  }
  .req-text {
    flex: 1;
    min-width: 0;
  }
  .btn.small {
    min-height: 40px;
    padding: 0 16px;
    font-size: 15px;
  }
  .invite-dialog {
    width: min(480px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: var(--surface);
    color: var(--text);
  }
  .invite-dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
  }
  .invite-box {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .invite-box h2 {
    margin: 0;
    font-size: 22px;
  }
  .invite-box :global(.invite) {
    margin-bottom: 0;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }
  .error {
    margin: 0;
    color: var(--coral-text);
    font-weight: 600;
  }
</style>
