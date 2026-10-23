<script lang="ts">
  import { tick } from 'svelte';
  import Avatar from '../components/Avatar.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import { KINDS, LIMITS, cleanSpec, describeEnd, specProblems } from '../lib/customGame';
  import { viewport } from '../lib/viewport.svelte';
  import type { CustomGameSpec, RoundMeta } from '../lib/types';

  /** Build or edit a game of your own: how it's won, when it ends, and how scores go in. */
  interface Props {
    initial: CustomGameSpec;
    /** True when editing a saved game (shows copy and delete). */
    existing: boolean;
    onsave: (spec: CustomGameSpec) => void;
    oncancel: () => void;
    oncopy?: () => void;
    ondelete?: () => void;
  }

  let { initial, existing, onsave, oncancel, oncopy, ondelete }: Props = $props();

  const start = (() => JSON.parse(JSON.stringify(initial)) as CustomGameSpec)();
  let spec = $state<CustomGameSpec>(start);

  // Optional parts keep their settings while switched off, so toggling doesn't lose them.
  let outOn = $state(start.out !== null);
  let outCfg = $state(start.out ?? { label: 'Went out', score: 0 as number | null, bonus: 0, othersGet: 0, penalty: 0 });
  let outSetsScore = $state(start.out ? start.out.score !== null : true);
  let quickOn = $state(start.quick !== null);
  let quickCfg = $state(start.quick ?? { label: 'Bust', score: 0 });
  let nameRounds = $state(start.roundNames !== null);
  let names = $state<RoundMeta[]>(start.roundNames ?? []);
  let pickingIcon = $state(false);
  let newShortcut = $state<number | null>(null);
  let tried = $state(false);
  let confirmingDelete = $state(false);

  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);

  /** The recipe as the form stands. */
  const built = $derived.by((): CustomGameSpec => ({
    ...spec,
    roundNames: nameRounds ? Array.from({ length: Math.max(0, int(spec.rounds)) }, (_, i) => names[i] ?? { label: '' }) : null,
    out: outOn
      ? { label: outCfg.label, score: outSetsScore ? int(outCfg.score) : null, bonus: int(outCfg.bonus), othersGet: int(outCfg.othersGet), penalty: int(outCfg.penalty) }
      : null,
    quick: quickOn ? { label: quickCfg.label, score: int(quickCfg.score) } : null,
  }));
  const problems = $derived(specProblems(built));
  const shown = $derived(tried ? problems : {});

  // Keep a name slot for every round while naming rounds.
  $effect(() => {
    const n = Math.min(LIMITS.rounds, Math.max(0, int(spec.rounds)));
    if (nameRounds && names.length < n) {
      names = [...names, ...Array.from({ length: n - names.length }, (_, i) => ({ label: `Round ${names.length + i + 1}` }))];
    }
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (Object.keys(problems).length > 0) {
      // Bring the first problem into view once it's highlighted.
      await tick();
      document.querySelector('.problem')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    onsave(cleanSpec($state.snapshot(built) as CustomGameSpec));
  }

  function addShortcut() {
    const v = int(newShortcut);
    if (v !== 0 && !spec.shortcuts.includes(v) && spec.shortcuts.length < LIMITS.shortcuts) spec.shortcuts = [...spec.shortcuts, v];
    newShortcut = null;
  }

  const signed = (n: number) => (n > 0 ? `+${n.toLocaleString('en-US')}` : n.toLocaleString('en-US').replace('-', '−'));
  const low = $derived(spec.win === 'lowest');

  // ---- Preview ----
  const sample = [
    { name: 'Ana', emoji: '🦉' },
    { name: 'Ben', emoji: '🦊' },
    { name: 'Cat', emoji: '🐼' },
  ];
  const sampleRound = $derived(
    built.end === 'rounds' ? (built.roundNames?.[2] ?? built.roundNames?.[0] ?? { label: 'Round 3' }) : { label: 'Round 3' },
  );
  const facts = $derived(
    [
      built.kind,
      `${int(built.players.min)}–${int(built.players.max)} players`,
      built.end === 'rounds' ? `${int(built.rounds)} rounds` : built.end === 'target' ? `to ${int(built.target).toLocaleString('en-US')}` : 'host ends it',
      built.rotateDealer ? 'dealer rotates' : '',
    ].filter(Boolean),
  );
</script>

<main class="screen wide builder">
  <div class="top-bar">
    <button type="button" class="icon-btn" aria-label="Cancel and go back" onclick={oncancel}>←</button>
    <p class="crumb">{existing ? 'Edit game' : 'New game'}</p>
  </div>

  <form class="layout" class:split={viewport.wide} onsubmit={save} novalidate>
    <div class="form">
      <h1 class="title">{existing ? spec.name || 'Edit game' : 'Build a game'}</h1>

      <!-- 1. Basics -->
      <section class="card" aria-labelledby="s-basics">
        <h2 id="s-basics" class="step">Basics</h2>
        <div class="name-row">
          <button type="button" class="icon-pick" aria-label="Game icon {spec.icon}, change" aria-expanded={pickingIcon} onclick={() => (pickingIcon = !pickingIcon)}>
            {spec.icon}
          </button>
          <label class="grow">
            <span class="visually-hidden">Game name</span>
            <input class="text-input" class:problem={shown.name} maxlength={LIMITS.name} placeholder="Phase 10" bind:value={spec.name} />
          </label>
        </div>
        {#if shown.name}<p class="error">{shown.name}</p>{/if}
        {#if pickingIcon}
          <EmojiPicker
            value={spec.icon}
            label="Game icon"
            onpick={(e) => {
              spec.icon = e;
              pickingIcon = false;
            }}
          />
        {/if}
        <fieldset class="field">
          <legend>Kind of game</legend>
          <div class="seg">
            {#each KINDS as k (k)}
              <label class:on={spec.kind === k}><input type="radio" value={k} bind:group={spec.kind} />{k}</label>
            {/each}
          </div>
        </fieldset>
        <div class="line" class:problem={shown.players}>
          <span>Suggested players</span>
          <span class="pair">
            <input class="num" type="number" inputmode="numeric" min="1" max={LIMITS.players} aria-label="Fewest players" bind:value={spec.players.min} />
            to
            <input class="num" type="number" inputmode="numeric" min="1" max={LIMITS.players} aria-label="Most players" bind:value={spec.players.max} />
          </span>
        </div>
        {#if shown.players}<p class="error">{shown.players}</p>{:else}<p class="hint">Only a suggestion. Tables can go bigger.</p>{/if}
      </section>

      <!-- 2. How you win -->
      <section class="card" aria-labelledby="s-win">
        <h2 id="s-win" class="step">How you win</h2>
        <div class="seg big">
          <label class:on={spec.win === 'highest'}><input type="radio" value="highest" bind:group={spec.win} />Highest total</label>
          <label class:on={spec.win === 'lowest'}><input type="radio" value="lowest" bind:group={spec.win} />Lowest total</label>
        </div>
      </section>

      <!-- 3. When it ends -->
      <section class="card" aria-labelledby="s-end">
        <h2 id="s-end" class="step">When it ends</h2>
        <div class="seg big">
          <label class:on={spec.end === 'rounds'}><input type="radio" value="rounds" bind:group={spec.end} />After set rounds</label>
          <label class:on={spec.end === 'target'}><input type="radio" value="target" bind:group={spec.end} />At a target score</label>
          <label class:on={spec.end === 'host'}><input type="radio" value="host" bind:group={spec.end} />Host ends it</label>
        </div>
        <div class="sub">
          {#if spec.end === 'rounds'}
            <div class="line" class:problem={shown.rounds}>
              <span>Rounds</span>
              <input class="num" type="number" inputmode="numeric" min="1" max={LIMITS.rounds} aria-label="Number of rounds" bind:value={spec.rounds} />
            </div>
            {#if shown.rounds}<p class="error">{shown.rounds}</p>{/if}
            <label class="toggle">
              <span>Name each round <small>like “3 cards” or “Wilds: 2s”</small></span>
              <input type="checkbox" role="switch" bind:checked={nameRounds} />
              <span class="track" aria-hidden="true"></span>
            </label>
            {#if nameRounds}
              <ol class="round-names">
                {#each names.slice(0, Math.min(LIMITS.rounds, Math.max(0, int(spec.rounds)))) as _, i (i)}
                  <li>
                    <span class="rn">{i + 1}</span>
                    <input class="text-input small" maxlength="24" aria-label="Round {i + 1} name" placeholder="Round {i + 1}" bind:value={names[i].label} />
                    <input
                      class="text-input small note"
                      maxlength="40"
                      aria-label="Round {i + 1} note"
                      placeholder="Note (optional)"
                      value={names[i].note ?? ''}
                      oninput={(e) => (names[i] = { ...names[i], note: e.currentTarget.value })}
                    />
                  </li>
                {/each}
              </ol>
            {/if}
          {:else if spec.end === 'target'}
            <div class="line" class:problem={shown.target}>
              <span>{low ? 'Game ends when someone reaches' : 'Target score'}</span>
              <input class="num wide-num" type="number" inputmode="numeric" min="1" aria-label="Target score" bind:value={spec.target} />
            </div>
            {#if shown.target}<p class="error">{shown.target}</p>{/if}
            {#if !low}
              <label class="toggle">
                <span>Everyone else gets one last turn <small>once someone reaches it</small></span>
                <input type="checkbox" role="switch" bind:checked={spec.finalTurns} />
                <span class="track" aria-hidden="true"></span>
              </label>
            {/if}
          {:else}
            <p class="hint">Play as many rounds as you like. An <strong>End game</strong> button shows after the first round.</p>
          {/if}
        </div>
      </section>

      <!-- 4. Entering scores -->
      <section class="card" aria-labelledby="s-entry">
        <h2 id="s-entry" class="step">Entering scores</h2>
        <div class="line" class:problem={shown.entryLabel}>
          <span>Players enter</span>
          <input class="text-input small label-input" maxlength="24" aria-label="What players enter" placeholder="Points" bind:value={spec.entryLabel} />
        </div>
        {#if shown.entryLabel}<p class="error">{shown.entryLabel}</p>{/if}
        <label class="toggle">
          <span>Allow negative scores</span>
          <input type="checkbox" role="switch" bind:checked={spec.allowNegative} />
          <span class="track" aria-hidden="true"></span>
        </label>
        <label class="toggle">
          <span>Big numbers <small>up to 9,999,999</small></span>
          <input type="checkbox" role="switch" bind:checked={spec.bigNumbers} />
          <span class="track" aria-hidden="true"></span>
        </label>
        <div class="field">
          <span class="legend">Tap-to-add buttons <small>on phones</small></span>
          <div class="chips">
            {#each spec.shortcuts as v (v)}
              <span class="chip">
                {signed(v)}
                <button type="button" aria-label="Remove {signed(v)}" onclick={() => (spec.shortcuts = spec.shortcuts.filter((x) => x !== v))}>×</button>
              </span>
            {/each}
            {#if spec.shortcuts.length < LIMITS.shortcuts}
              <span class="add-chip">
                <input
                  class="num"
                  type="number"
                  inputmode="numeric"
                  aria-label="New button value"
                  placeholder="25"
                  bind:value={newShortcut}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addShortcut();
                    }
                  }}
                />
                <button type="button" class="btn small" onclick={addShortcut}>Add</button>
              </span>
            {/if}
          </div>
          {#if shown.shortcuts}<p class="error">{shown.shortcuts}</p>{/if}
        </div>
      </section>

      <!-- 5. Round buttons -->
      <section class="card" aria-labelledby="s-buttons">
        <h2 id="s-buttons" class="step">Round buttons <small>optional</small></h2>
        <label class="toggle">
          <span>Mark a player each round <small>“Went out”, “Called it”… one player a round</small></span>
          <input type="checkbox" role="switch" bind:checked={outOn} />
          <span class="track" aria-hidden="true"></span>
        </label>
        {#if outOn}
          <div class="sub">
            <div class="line" class:problem={shown.out}>
              <span>Button label</span>
              <input class="text-input small label-input" maxlength={LIMITS.label} aria-label="Marker button label" bind:value={outCfg.label} />
            </div>
            {#if shown.out}<p class="error">{shown.out}</p>{/if}
            <label class="toggle">
              <span>It sets their score</span>
              <input type="checkbox" role="switch" bind:checked={outSetsScore} />
              <span class="track" aria-hidden="true"></span>
            </label>
            {#if outSetsScore}
              <div class="line">
                <span>Their score becomes</span>
                <input class="num" type="number" inputmode="numeric" aria-label="Score for the marked player" bind:value={outCfg.score} />
              </div>
            {:else}
              <p class="hint">They still enter a score; the button only marks who it was.</p>
            {/if}
            <div class="line">
              <span>Bonus for them <small>{low ? 'negative helps' : 'positive helps'}</small></span>
              <input class="num" type="number" inputmode="numeric" aria-label="Bonus for the marked player" bind:value={outCfg.bonus} />
            </div>
            <div class="line">
              <span>If theirs was the best score, everyone else gets</span>
              <input class="num" type="number" inputmode="numeric" aria-label="Points for everyone else" bind:value={outCfg.othersGet} />
            </div>
            <div class="line">
              <span>If it wasn’t, they get</span>
              <input class="num" type="number" inputmode="numeric" aria-label="Penalty for the marked player" bind:value={outCfg.penalty} />
            </div>
            <p class="hint">Leave at 0 to skip. “Best” means {low ? 'lowest' : 'highest'}, with no ties.</p>
          </div>
        {/if}

        <label class="toggle">
          <span>Quick score button <small>anyone can tap it, like “Bust = 0”</small></span>
          <input type="checkbox" role="switch" bind:checked={quickOn} />
          <span class="track" aria-hidden="true"></span>
        </label>
        {#if quickOn}
          <div class="sub">
            <div class="line" class:problem={shown.quick}>
              <span>Button label</span>
              <input class="text-input small label-input" maxlength={LIMITS.label} aria-label="Quick score label" bind:value={quickCfg.label} />
            </div>
            {#if shown.quick}<p class="error">{shown.quick}</p>{/if}
            <div class="line">
              <span>Scores</span>
              <input class="num" type="number" inputmode="numeric" aria-label="Quick score value" bind:value={quickCfg.score} />
            </div>
            {#if outOn}<p class="hint">Phones show one button: the marker. The quick button is on the host’s screen.</p>{/if}
          </div>
        {/if}
      </section>

      <!-- 6. At the table -->
      <section class="card" aria-labelledby="s-table">
        <h2 id="s-table" class="step">At the table</h2>
        <label class="toggle">
          <span>Rotate dealer each round</span>
          <input type="checkbox" role="switch" bind:checked={spec.rotateDealer} />
          <span class="track" aria-hidden="true"></span>
        </label>
        <label class="field">
          <span class="legend">Cheat sheet <small>one line shown while scoring</small></span>
          <input class="text-input" maxlength={LIMITS.cheatSheet} placeholder="Complete your phase before going out" bind:value={spec.cheatSheet} />
        </label>
        <div class="field">
          <span class="legend">House rules <small>shown with the game</small></span>
          <ol class="notes">
            {#each spec.notes as _, i (i)}
              <li>
                <input class="text-input" maxlength={LIMITS.note} aria-label="House rule {i + 1}" bind:value={spec.notes[i]} />
                <button type="button" class="icon-btn" aria-label="Remove rule {i + 1}" onclick={() => (spec.notes = spec.notes.filter((_, j) => j !== i))}>×</button>
              </li>
            {/each}
          </ol>
          {#if spec.notes.length < LIMITS.notes}
            <button type="button" class="link" onclick={() => (spec.notes = [...spec.notes, ''])}>+ Add a rule</button>
          {/if}
        </div>
      </section>

      {#if existing}
        <div class="manage">
          {#if oncopy}<button type="button" class="btn" onclick={oncopy}>Make a copy</button>{/if}
          {#if ondelete}<button type="button" class="btn danger-text" onclick={() => (confirmingDelete = true)}>Delete game</button>{/if}
        </div>
      {/if}

      {#if !viewport.wide}
        {@render preview()}
        {@render buttons()}
      {/if}
    </div>

    {#if viewport.wide}
      <aside class="side">
        {@render preview()}
        {@render buttons()}
      </aside>
    {/if}
  </form>
</main>

{#snippet preview()}
  <section class="card preview" aria-label="Preview">
    <h2 class="step">Preview</h2>
    <div class="pv-head">
      <span class="pv-icon" aria-hidden="true">{built.icon}</span>
      <div>
        <p class="pv-name">{built.name.trim() || 'Your game'}</p>
        <p class="pv-meta">{facts.join(' · ')}</p>
      </div>
    </div>
    <p class="pv-rule">{describeEnd({ ...built, rounds: int(built.rounds), target: int(built.target) })}</p>
  </section>
  <section class="card preview" aria-label="Sample round">
    <h2 class="pv-round">{sampleRound.label}{#if sampleRound.note}<span class="pv-note">{sampleRound.note}</span>{/if}</h2>
    <p class="pv-sub">{built.entryLabel.trim() || 'Score'}</p>
    <ul class="pv-rows">
      {#each sample as p, i (p.name)}
        <li>
          <Avatar name={p.name} seat={i} emoji={p.emoji} size={32} />
          <span class="pv-who">{p.name}{#if built.rotateDealer && i === 2}<span class="badge">Dealer</span>{/if}</span>
          {#if built.out}<span class="pv-btn" class:on={i === 0}>{built.out.label || 'Went out'}</span>{/if}
          {#if built.quick}<span class="pv-btn" class:on={i === 1 && !built.out}>{built.quick.label || 'Quick'}</span>{/if}
          <span class="pv-score">{i === 0 && built.out && built.out.score !== null ? built.out.score : ['', 35, 20][i] || '–'}</span>
        </li>
      {/each}
    </ul>
    <p class="pv-phone">
      Phones: “Your {(built.entryLabel.trim() || 'score').toLowerCase()}”{built.shortcuts.length ? ` · ${built.shortcuts.map(signed).join(' ')}` : ''}{built.out
        ? ` · ${built.out.label}`
        : built.quick
          ? ` · ${built.quick.label}`
          : ''}
    </p>
  </section>
{/snippet}

{#snippet buttons()}
  <div class="actions">
    {#if tried && Object.keys(problems).length > 0}
      <p class="error" role="alert">Fix the {Object.keys(problems).length === 1 ? 'highlighted field' : 'highlighted fields'} to save.</p>
    {/if}
    <div class="two">
      <button type="button" class="btn" onclick={oncancel}>Cancel</button>
      <button type="submit" class="btn btn-primary">Save game</button>
    </div>
  </div>
{/snippet}

<ConfirmDialog
  open={confirmingDelete}
  title="Delete {spec.name || 'this game'}?"
  message="It comes off your games list. Games you already played with it keep their scores."
  confirmLabel="Delete game"
  cancelLabel="Keep it"
  danger
  onconfirm={() => {
    confirmingDelete = false;
    ondelete?.();
  }}
  oncancel={() => (confirmingDelete = false)}
/>

<style>
  .crumb {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .layout.split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: 32px;
    align-items: start;
  }
  .side {
    position: sticky;
    top: 16px;
    display: flex;
    flex-direction: column;
  }
  .side .actions {
    position: static;
    background: none;
  }
  .form {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .card {
    margin-bottom: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 20px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .step {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  small {
    display: block;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--muted);
  }
  .step small {
    display: inline;
    margin-left: 6px;
  }
  .name-row {
    display: flex;
    gap: 10px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .icon-pick {
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 28px;
    cursor: pointer;
  }
  .field {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  legend,
  .legend {
    padding: 0;
    margin-bottom: 8px;
    font-weight: 650;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .seg label {
    min-height: 40px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 650;
    cursor: pointer;
  }
  .seg.big label {
    flex: 1 1 140px;
    min-height: 48px;
    justify-content: center;
    border-radius: 14px;
  }
  .seg label.on {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--on-amber);
  }
  .seg label:has(input:focus-visible) {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .seg input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .line {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .pair {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .num {
    width: 84px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-size: 17px;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .num.wide-num {
    width: 130px;
  }
  .num:focus,
  .text-input.small:focus {
    border-color: var(--amber);
    outline: none;
  }
  .text-input.small {
    min-height: 44px;
    font-size: 16px;
    background: var(--surface-2);
  }
  .label-input {
    width: 170px;
  }
  .problem .num,
  .problem .text-input,
  .text-input.problem {
    border-color: var(--coral);
  }
  .error {
    margin: 0;
    color: var(--coral-text);
    font-size: 14px;
    font-weight: 600;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }
  .sub {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-left: 14px;
    border-left: 2px solid var(--line);
  }
  .toggle {
    min-height: 56px;
    padding: 6px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    position: relative;
    font-weight: 600;
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
  .round-names,
  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .round-names {
    max-height: 360px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .round-names li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }
  .rn {
    color: var(--muted);
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .notes li {
    display: flex;
    gap: 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .chip {
    min-height: 40px;
    padding: 0 6px 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-weight: 700;
  }
  .chip button {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    font-size: 17px;
    cursor: pointer;
  }
  .add-chip {
    display: inline-flex;
    gap: 6px;
  }
  .btn.small {
    min-height: 44px;
    font-size: 15px;
    padding: 0 14px;
  }
  .link {
    align-self: flex-start;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--teal);
    font-weight: 700;
    cursor: pointer;
  }
  .manage {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .danger-text {
    color: var(--coral-text);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
  }
  /* Preview */
  .preview {
    border-color: var(--amber);
  }
  .preview + .preview {
    border-color: var(--line);
  }
  .pv-round {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
  }
  .pv-note {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--amber);
    color: var(--on-amber);
    font-size: 13px;
  }
  .pv-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pv-icon {
    font-size: 36px;
  }
  .pv-name {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }
  .pv-meta,
  .pv-rule,
  .pv-sub,
  .pv-phone {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .pv-rule {
    color: var(--text);
  }
  .pv-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pv-rows li {
    min-height: 48px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 14px;
    background: var(--surface-2);
  }
  .pv-who {
    flex: 1;
    font-weight: 700;
  }
  .badge {
    margin-left: 6px;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--surface);
    color: var(--muted);
    font-size: 11px;
  }
  .pv-btn {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }
  .pv-btn.on {
    border-color: var(--teal);
    color: var(--teal);
  }
  .pv-score {
    min-width: 40px;
    text-align: right;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
</style>
