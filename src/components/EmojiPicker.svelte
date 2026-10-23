<script lang="ts">
  import { EMOJI_GROUPS } from '../lib/emoji';

  interface Props {
    value: string | undefined;
    /** Emoji other players already use; shown but not pickable. */
    taken?: Set<string>;
    onpick: (emoji: string) => void;
    label?: string;
  }

  let { value, taken = new Set(), onpick, label = 'Pick an avatar' }: Props = $props();

  const groupOf = (e: string | undefined) => Math.max(0, EMOJI_GROUPS.findIndex((g) => e !== undefined && g.emoji.includes(e)));
  // Open on the group holding the current pick, so it's in view. The pick can arrive
  // a moment later (a random one once the lobby loads), so follow it until a group is tapped.
  let chosen = $state<number | null>(null);
  const group = $derived(chosen ?? groupOf(value));
  const shown = $derived(EMOJI_GROUPS[group]);
</script>

<div class="picker">
  <div class="groups" role="group" aria-label="Avatar categories">
    {#each EMOJI_GROUPS as g, i (g.name)}
      <button type="button" class="chip" aria-pressed={i === group} onclick={() => (chosen = i)}>
        <span aria-hidden="true">{g.emoji[0]}</span>
        {g.name}
      </button>
    {/each}
  </div>

  <div class="grid" role="group" aria-label="{label}: {shown.name}">
    {#each shown.emoji as emoji (emoji)}
      {@const isTaken = taken.has(emoji) && emoji !== value}
      <button
        type="button"
        class="cell"
        aria-pressed={emoji === value}
        aria-label={isTaken ? `${emoji} (taken)` : emoji}
        disabled={isTaken}
        onclick={() => onpick(emoji)}>{emoji}</button
      >
    {/each}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 40px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--amber);
    background: var(--amber);
    color: var(--on-amber);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 6px;
    /* Same height whichever group is open, so the page doesn't jump. */
    min-height: 200px;
    align-content: start;
  }
  .cell {
    aspect-ratio: 1;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .cell[aria-pressed='true'] {
    border: 2px solid var(--amber);
    background: var(--surface-2);
  }
  .cell:disabled {
    opacity: 0.25;
    cursor: default;
  }
</style>
