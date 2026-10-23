<script lang="ts">
  /**
   * A banner for a moment in the game ("Ana takes the lead!"). It shows for a few
   * seconds each time a new callout arrives, but not for one already on screen when
   * this mounts, so reopening a game doesn't replay an old moment.
   */
  import { fly } from 'svelte/transition';
  import Avatar from './Avatar.svelte';
  import type { Callout } from '../lib/lobbyTypes';

  interface Props {
    callout: Callout | null | undefined;
    /** The player the callout is about, for their avatar. */
    player?: { name: string; emoji?: string } | null;
  }

  let { callout, player = null }: Props = $props();

  // Whatever is there on mount counts as already seen.
  const initial = (() => callout?.id ?? null)();
  let shown = $state<Callout | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const next = callout;
    if (!next || next.id === initial || next.id === shown?.id) return;
    shown = next;
    clearTimeout(timer);
    timer = setTimeout(() => (shown = null), 4000);
  });

  $effect(() => () => clearTimeout(timer));

  const icon: Record<Callout['kind'], string> = { lead: '👑', tie: '🤝', climb: '🚀' };
</script>

{#if shown}
  {#key shown.id}
    <div class="toast" role="status" in:fly={{ y: -24, duration: 250 }} out:fly={{ y: -24, duration: 200 }}>
      {#if player}
        <Avatar name={player.name} seat={shown.seat} emoji={player.emoji} size={36} />
      {/if}
      <span class="text">{shown.text}</span>
      <span class="icon" aria-hidden="true">{icon[shown.kind]}</span>
      <button type="button" class="close" aria-label="Dismiss" onclick={() => (shown = null)}>×</button>
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    z-index: 40;
    width: max-content;
    max-width: calc(100vw - 32px);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 8px 8px 10px;
    border-radius: 999px;
    border: 2px solid var(--amber);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.3);
  }
  .text {
    font-weight: 800;
    font-size: 16px;
  }
  .icon {
    font-size: 20px;
  }
  .close {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
  }
</style>
