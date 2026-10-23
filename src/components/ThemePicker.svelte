<script lang="ts">
  import { applyTheme, loadTheme, saveTheme, THEMES, type ThemeChoice } from '../lib/theme';

  /** A palette button that opens a sheet of themes. The choice is saved on this device only. */
  let choice = $state<ThemeChoice>(loadTheme());
  let dialog = $state<HTMLDialogElement>();

  interface Option {
    id: ThemeChoice;
    name: string;
    blurb: string;
    preview: string[];
  }
  const asOption = (t: (typeof THEMES)[number]): Option => ({ id: t.id, name: t.name, blurb: t.blurb, preview: [t.id] });
  const options: Option[] = [
    { id: 'system', name: 'Match my device', blurb: 'Light or dark, following this device', preview: ['beige', 'midnight'] },
    ...THEMES.map(asOption),
  ];

  function pick(id: ThemeChoice) {
    choice = id;
    saveTheme(id);
    applyTheme(id);
  }
</script>

<button type="button" class="icon-btn" aria-label="Change theme" aria-haspopup="dialog" onclick={() => dialog?.showModal()}>
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3a9 9 0 100 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.2-4-7.7-9-7.7z" />
    <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1.2" fill="currentColor" />
  </svg>
</button>

<dialog bind:this={dialog} aria-labelledby="theme-title" onclick={(e) => e.target === dialog && dialog?.close()}>
  <div class="sheet">
    <div class="head">
      <h2 id="theme-title">Theme</h2>
      <button type="button" class="icon-btn" aria-label="Close" onclick={() => dialog?.close()}>×</button>
    </div>
    <p class="hint">Just for this device. Everyone at the table can pick their own.</p>
    <div class="options" role="radiogroup" aria-labelledby="theme-title">
      {#each options as o (o.id)}
        <button type="button" role="radio" aria-checked={choice === o.id} class="option" onclick={() => pick(o.id)}>
          <span class="previews" aria-hidden="true">
            {#each o.preview as t (t)}
              <!-- Each preview paints with its own theme's colors. -->
              <span class="preview" data-theme={t}>
                <span class="card"><span class="dot"></span><span class="bar"></span></span>
                <span class="pill"></span>
              </span>
            {/each}
          </span>
          <span class="text">
            <span class="name">{o.name}</span>
            <span class="blurb">{o.blurb}</span>
          </span>
          <span class="check" aria-hidden="true">
            {#if choice === o.id}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(430px, 100vw);
    max-height: 90dvh;
    overflow: hidden;
    margin: auto auto 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 24px 24px 0 0;
    background: var(--bg);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
  }
  @media (min-width: 600px) {
    dialog {
      width: min(760px, calc(100vw - 48px));
      margin: auto;
      border-radius: 24px;
    }
  }
  /* The title stays put; only the list scrolls. */
  .sheet {
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
    padding: 16px 16px 0;
  }
  .options {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h2 {
    margin: 0;
    font-size: 24px;
  }
  .hint {
    margin: 4px 0 14px;
    color: var(--muted);
    font-size: 14px;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 12px 8px 8px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .option[aria-checked='true'] {
    border: 2px solid var(--amber);
  }
  .previews {
    display: flex;
    flex: none;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--line);
  }
  .preview {
    width: 64px;
    height: 48px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: var(--bg);
  }
  .previews .preview + .preview {
    width: 32px;
  }
  .preview .card {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 18px;
    padding: 0 4px;
    border-radius: 5px;
    background: var(--surface-2);
  }
  .preview .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--teal);
  }
  .preview .bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--text);
    opacity: 0.8;
  }
  .preview .pill {
    height: 10px;
    border-radius: 5px;
    background: var(--amber);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-weight: 700;
  }
  .blurb {
    font-size: 13px;
    color: var(--muted);
  }
  .check {
    width: 18px;
    flex: none;
    color: var(--amber);
  }
  /* After the base .options rule so it wins: two columns on wider screens. */
  @media (min-width: 600px) {
    .options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: start;
    }
  }
</style>
