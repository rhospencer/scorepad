<script lang="ts">
  /**
   * Add a player mid-game: typed in by the host, or a phone asking to join. Players who
   * missed rounds get a starting score the host picks (in lowest-wins games, a penalty
   * so joining late isn't a head start).
   */
  import Avatar from './Avatar.svelte';
  import EmojiPicker from './EmojiPicker.svelte';
  import { cantAddReason, defaultLateStart, lateStartChoices, type LateStart } from '../lib/lateJoin';
  import { nameKey } from '../lib/people';
  import type { GameModule, Session } from '../lib/types';

  export interface JoinRequest {
    lobbyId: string;
    name: string;
    emoji: string;
    personId?: string;
  }

  interface Props {
    open: boolean;
    game: GameModule;
    session: Session;
    /** A phone asking to join; null when the host is typing someone in. */
    request?: JoinRequest | null;
    onadd: (player: { name: string; emoji?: string; lobbyId?: string; personId?: string }, start: number) => void;
    oncancel: () => void;
    /** Turn a phone's request down. */
    ondecline?: () => void;
    /** The phone belongs to a player already in the game: typed in by the host, or rejoining from a new phone. */
    onlink?: (seat: number) => void;
  }

  let { open, game, session, request = null, onadd, oncancel, ondecline, onlink }: Props = $props();

  /** For a phone's request: the player already in the game it is, or 'new' for a newcomer. */
  let linkTo = $state<number | 'new'>('new');

  let dialog = $state<HTMLDialogElement>();
  let name = $state('');
  let emoji = $state<string | undefined>(undefined);
  let picking = $state(false);
  let choice = $state<LateStart>('last');
  let extra = $state(10);
  let fixed = $state(50);

  // Fresh form each time it opens.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      name = '';
      emoji = undefined;
      picking = false;
      choice = defaultLateStart(game);
      // A phone whose name matches a player is probably them (typed in, or rejoining).
      const match = request ? linkable.find((i) => nameKey(session.players[i].name) === nameKey(request!.name)) : undefined;
      linkTo = match ?? 'new';
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  const round = $derived(session.scores.length);
  const linkable = $derived(request && onlink ? session.players.map((_, i) => i) : []);
  const linking = $derived(linkTo !== 'new');
  const reason = $derived(cantAddReason(game, session));
  const low = $derived(game.winner.rule === 'lowest-total');
  const choices = $derived(lateStartChoices(game, session, Number(extra) || 0, Number(fixed) || 0));
  const start = $derived(round === 0 ? 0 : (choices.find((c) => c.id === choice)?.value ?? 0));
  const who = $derived(request ? request.name : name.trim());
  const taken = $derived(new Set(session.players.flatMap((p) => (p.emoji ? [p.emoji] : []))));
  const num = new Intl.NumberFormat();

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (linking) {
      onlink?.(linkTo as number);
      return;
    }
    if (reason || !who) return;
    onadd(
      request
        ? { name: request.name, emoji: request.emoji, lobbyId: request.lobbyId, personId: request.personId }
        : { name: name.trim(), emoji },
      start,
    );
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="add-title"
  oncancel={(e) => {
    e.preventDefault();
    oncancel();
  }}
  onclick={(e) => e.target === dialog && oncancel()}
>
  <form class="box" onsubmit={submit}>
    {#if request}
      <div class="who">
        <Avatar name={request.name} seat={session.players.length} emoji={request.emoji} size={48} />
        <div>
          <h2 id="add-title">{request.name} wants to join</h2>
          <p class="muted">From their phone{round > 0 ? ` · would start round ${round + 1}` : ''}</p>
        </div>
      </div>
    {:else}
      <h2 id="add-title">Add a player</h2>
      <div class="name-row">
        <button type="button" class="emoji-btn" aria-label="Pick an avatar" aria-expanded={picking} onclick={() => (picking = !picking)}>
          <Avatar name={name || '?'} seat={session.players.length} {emoji} size={40} />
        </button>
        <label class="grow">
          <span class="visually-hidden">Name</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input class="text-input" maxlength="20" placeholder="Name" autocomplete="off" autofocus bind:value={name} />
        </label>
      </div>
      {#if picking}
        <EmojiPicker
          value={emoji}
          {taken}
          onpick={(e) => {
            emoji = e;
            picking = false;
          }}
        />
      {/if}
    {/if}

    {#if linkable.length > 0}
      <fieldset class="starts">
        <legend>Who is this?</legend>
        {#each linkable as i (session.players[i].id)}
          {@const p = session.players[i]}
          <label class="opt" class:on={linkTo === i}>
            <input type="radio" name="link" value={i} bind:group={linkTo} />
            <Avatar name={p.name} seat={i} emoji={p.emoji} size={28} />
            <span class="opt-label">{p.name} <span class="muted">· {p.lobbyId ? 'rejoining' : 'already playing'}</span></span>
          </label>
        {/each}
        <label class="opt" class:on={linkTo === 'new'}>
          <input type="radio" name="link" value="new" bind:group={linkTo} />
          <span class="opt-label">Someone new</span>
        </label>
      </fieldset>
    {/if}

    {#if linking}
      <p class="muted">
        Their phone takes over sending {session.players[linkTo as number].name}’s scores. Scores so far stay as they are.
      </p>
    {:else if reason}
      <p class="blocked" role="alert">{reason}</p>
    {:else if round === 0}
      <p class="muted">They’ll play from round 1. Nothing missed yet.</p>
    {:else}
      <p class="muted">
        Joins from round {round + 1} · missed {round} {round === 1 ? 'round' : 'rounds'}
      </p>
      <fieldset class="starts">
        <legend>Starting score <span class="muted">· {low ? 'lowest wins' : 'highest wins'}</span></legend>
        {#each choices as c (c.id)}
          <label class="opt" class:on={choice === c.id}>
            <input type="radio" name="start" value={c.id} bind:group={choice} />
            <span class="opt-label">
              {c.label}
              {#if c.id === 'lastPlus'}
                <input class="mini" type="number" inputmode="numeric" min="0" aria-label="Points added to last place" bind:value={extra} />
              {:else if c.id === 'fixed'}
                <input class="mini" type="number" inputmode="numeric" aria-label="Set starting score" bind:value={fixed} />
              {/if}
            </span>
            <span class="val">{num.format(c.value)}</span>
          </label>
        {/each}
      </fieldset>
    {/if}

    <div class="buttons">
      {#if request && ondecline}
        <button type="button" class="btn" onclick={ondecline}>Not now</button>
      {:else}
        <button type="button" class="btn" onclick={oncancel}>Cancel</button>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={!linking && (!!reason || !who)}>
        {linking ? `Link to ${session.players[linkTo as number].name}` : request ? `Let ${request.name} in` : who ? `Add ${who}` : 'Add player'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(460px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: var(--surface);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
  }
  .box {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .name-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .emoji-btn {
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface-2);
    cursor: pointer;
  }
  .blocked {
    margin: 0;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--coral);
    color: var(--coral-text);
    font-weight: 600;
  }
  .starts {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  legend {
    padding: 0;
    margin-bottom: 8px;
    font-weight: 700;
  }
  .opt {
    min-height: 48px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    cursor: pointer;
    position: relative;
  }
  .opt.on {
    border-color: var(--amber);
  }
  .opt:has(input[type='radio']:focus-visible) {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .opt input[type='radio'] {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .opt-label {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .mini {
    width: 64px;
    min-height: 32px;
    padding: 0 6px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-weight: 700;
    text-align: center;
  }
  .val {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .opt.on .val {
    color: var(--amber);
  }
  .buttons {
    margin-top: 6px;
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
  }
  .buttons .btn {
    min-height: 52px;
    font-size: 16px;
  }
</style>
