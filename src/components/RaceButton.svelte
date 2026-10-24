<script lang="ts">
  /** A chart button that opens the score race in a pop-up. Hidden until two rounds are scored. */
  import ScoreRace from './ScoreRace.svelte';
  import type { RaceData } from '../lib/race';

  interface Props {
    race: RaceData | null | undefined;
    /** A smaller button, beside a section heading (phones' standings). */
    small?: boolean;
  }

  let { race, small = false }: Props = $props();

  let open = $state(false);
  let dialog = $state<HTMLDialogElement>();
  const rounds = $derived(race ? (race.series[0]?.length ?? 1) - 1 : 0);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

{#if race && rounds >= 2}
  <button type="button" class="icon-btn" class:small aria-label="Score race chart" title="Score race" onclick={() => (open = true)}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></svg>
  </button>

  <dialog
    bind:this={dialog}
    aria-label="Score race"
    oncancel={(e) => {
      e.preventDefault();
      open = false;
    }}
    onclick={(e) => e.target === dialog && (open = false)}
  >
    <div class="box">
      <div class="head">
        <h2>After round {rounds}</h2>
        <button type="button" class="close" aria-label="Close chart" onclick={() => (open = false)}>×</button>
      </div>
      {#if open}<ScoreRace {race} />{/if}
    </div>
  </dialog>
{/if}

<style>
  .small {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  dialog {
    width: min(760px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
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
    padding: 16px 16px 8px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .close {
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 22px;
    cursor: pointer;
  }
  /* The chart's own card blends into the pop-up. */
  .box :global(.race) {
    margin-top: 8px;
    padding: 0;
    border: 0;
    background: none;
  }
</style>
