<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The app's own confirmation dialog (instead of the browser's confirm()).
   * Escape, the backdrop and Cancel all cancel; focus starts on Cancel so a stray
   * Return never confirms something destructive.
   */
  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    /** Red confirm button, for things that can't be undone. */
    danger?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
    /** Extra detail shown under the message. */
    children?: Snippet;
  }

  let { open, title, message, confirmLabel, cancelLabel = 'Cancel', danger = false, onconfirm, oncancel, children }: Props =
    $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="confirm-title"
  aria-describedby="confirm-message"
  oncancel={(e) => {
    e.preventDefault();
    oncancel();
  }}
  onclick={(e) => e.target === dialog && oncancel()}
>
  <div class="box">
    {#if danger}
      <span class="icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" /><path d="M9 7V4h6v3" /></svg>
      </span>
    {/if}
    <h2 id="confirm-title">{title}</h2>
    <p id="confirm-message">{message}</p>
    {@render children?.()}
    <div class="buttons">
      <!-- svelte-ignore a11y_autofocus -->
      <button type="button" class="btn" autofocus onclick={oncancel}>{cancelLabel}</button>
      <button type="button" class="btn" class:danger class:btn-primary={!danger} onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(420px, calc(100vw - 32px));
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
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .icon {
    width: 44px;
    height: 44px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--coral) 16%, transparent);
    color: var(--coral);
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }
  .buttons {
    margin-top: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .buttons .btn {
    min-height: 52px;
    font-size: 16px;
  }
  .danger {
    border-color: var(--coral);
    background: var(--coral);
    color: #1a0705;
  }
</style>
