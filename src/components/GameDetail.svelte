<script lang="ts">
  import { configuredGame } from '../lib/session';
  import type { GameModule } from '../lib/types';

  /** The desktop library's right pane: what a game is, how to play, and a Start button. */
  interface Props {
    game: GameModule;
    onstart: () => void;
    /** Games built in the app: open the builder. */
    onedit?: () => void;
  }

  let { game, onstart, onedit }: Props = $props();

  const num = new Intl.NumberFormat();

  const facts = $derived.by(() => {
    // Facts for the default setup; games with a length option say it's chosen at setup.
    const g = configuredGame(game);
    const w = g.winner;
    const lengthChoice = game.options.some((o) => o.type === 'choice' && o.id === 'length');
    const list = [{ label: 'Players', value: `${game.players.min}–${game.players.max}+` }];
    if (lengthChoice) list.push({ label: 'Length', value: 'Your choice' });
    else if (g.hostEnds) list.push({ label: 'Length', value: 'Host ends it' });
    else if (g.rounds) list.push({ label: 'Rounds', value: String(g.rounds.length) });
    if (w.rule === 'first-to-target') list.push({ label: 'Play to', value: num.format(w.target) });
    list.push({ label: 'Winner', value: w.rule === 'lowest-total' ? 'Lowest total' : 'Highest total' });
    if (game.about?.time) list.push({ label: 'Time', value: game.about.time });
    return list;
  });
</script>

<article class="detail" aria-labelledby="game-title">
  <header class="head">
    <div class="intro">
      <p class="eyebrow">{game.custom ? 'Your game' : game.mode}{game.about ? ` · ${game.about.kind}` : ''}</p>
      <h1 id="game-title">{game.name}</h1>
      {#if game.about}<p class="tagline">{game.about.tagline}</p>{/if}
    </div>
    {#if onedit}
      <button type="button" class="btn start-edit" onclick={onedit}>Edit game</button>
    {/if}
    <button type="button" class="btn btn-primary start" onclick={onstart}>
      Start a game
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  </header>

  <dl class="facts">
    {#each facts as f (f.label)}
      <div class="fact">
        <dt>{f.label}</dt>
        <dd>{f.value}</dd>
      </div>
    {/each}
  </dl>

  {#if game.about}
    <div class="panels">
      <section class="panel rules">
        <h2>How to play</h2>
        <ol>
          {#each game.about.rules as rule, i (i)}
            <li>{rule}</li>
          {/each}
        </ol>
      </section>
      {#if game.about.reference}
        <section class="panel reference">
          <h2>{game.about.reference.title}</h2>
          <dl>
            {#each game.about.reference.rows as row (row.label)}
              <div class="ref-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            {/each}
          </dl>
          {#if game.about.reference.note}<p class="note">{game.about.reference.note}</p>{/if}
        </section>
      {/if}
    </div>
  {/if}
</article>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }
  .intro {
    max-width: 640px;
  }
  .intro .eyebrow {
    margin-bottom: 10px;
  }
  h1 {
    margin: 0;
    font-size: 52px;
    line-height: 1;
  }
  .tagline {
    margin: 12px 0 0;
    font-size: 17px;
    line-height: 1.5;
    color: var(--muted);
  }
  .start-edit {
    margin-left: auto;
    padding: 0 22px;
    border-radius: 28px;
  }
  .start {
    padding: 0 28px;
    border-radius: 28px;
    font-weight: 800;
  }
  .facts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .fact {
    padding: 14px 18px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .fact dt {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .fact dd {
    margin: 4px 0 0;
    font-size: 22px;
    font-weight: 800;
  }
  .panels {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: flex-start;
  }
  .panel {
    min-width: 0;
    padding: 22px 24px;
    border-radius: 20px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .panel h2 {
    margin: 0 0 12px;
    font-size: 20px;
  }
  .rules {
    flex: 3 1 360px;
  }
  .rules ol {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 16px;
    line-height: 1.5;
  }
  .reference {
    flex: 2 1 260px;
    background: var(--surface-2);
  }
  .reference dl {
    margin: 0;
  }
  .ref-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }
  .ref-row dt {
    color: var(--text);
  }
  .ref-row dd {
    margin: 0;
    font-weight: 800;
    color: var(--amber);
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 12px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
