<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { seatColor } from '../lib/avatar';
  import { viewport } from '../lib/viewport.svelte';
  import type { RaceData } from '../lib/race';

  interface Props {
    /** Built by raceData() on the host, or sent to phones with the standings. */
    race: RaceData;
  }

  let { race }: Props = $props();

  const low = $derived(race.low);
  const players = $derived(race.players);
  /** Each player's running total: [start, after round 1, ...]. */
  const series = $derived(race.series);
  const rounds = $derived(Math.max(0, (series[0]?.length ?? 1) - 1));
  /** The first point of each player's line (late joiners start where they joined). */
  const from = (p: number) => race.from[p] ?? 0;
  const pointsFor = (s: number[], p: number) =>
    s
      .map((v, i) => [i, v] as const)
      .slice(from(p))
      .map(([i, v]) => `${x(i)},${y(v)}`)
      .join(' ');

  // Geometry in viewBox units. Room on the right for the name at each line's end.
  const W = $derived(viewport.wide ? 680 : 340);
  const H = $derived(viewport.wide ? 256 : 196);
  const L = $derived(viewport.wide ? 44 : 36);
  const R = 74;
  const T = 12;
  const B = 24;

  function niceStep(span: number): number {
    const raw = span / 4 || 1;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  }

  const scale = $derived.by(() => {
    const all = series.flatMap((s, p) => s.slice(from(p)));
    const step = niceStep(Math.max(...all) - Math.min(0, ...all));
    const lo = Math.floor(Math.min(0, ...all) / step) * step;
    const hi = Math.max(Math.ceil(Math.max(...all) / step) * step, lo + step);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
    return { lo, hi, ticks };
  });

  const x = (i: number) => L + (i * (W - L - R)) / rounds;
  const y = (v: number) => T + ((scale.hi - v) * (H - T - B)) / (scale.hi - scale.lo);

  const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  const num = new Intl.NumberFormat();

  /** Round numbers along the bottom, thinned so they never crowd, always ending on the last round. */
  const xTicks = $derived.by(() => {
    const stride = Math.ceil(rounds / (viewport.wide ? 12 : 6));
    const out: number[] = [];
    for (let i = rounds; i >= stride; i -= stride) out.unshift(i);
    return out;
  });

  const shortName = (name: string) => (name.length > 9 ? `${name.slice(0, 8)}…` : name);

  /** Names at the end of each line, nudged apart so they don't overlap. */
  const endLabels = $derived.by(() => {
    const gap = 13;
    const rows = series
      .map((s, p) => ({ p, at: y(s[rounds]), labelY: y(s[rounds]) }))
      .sort((a, b) => a.at - b.at);
    for (let i = 1; i < rows.length; i++) rows[i].labelY = Math.max(rows[i].labelY, rows[i - 1].labelY + gap);
    const over = rows.length ? rows[rows.length - 1].labelY - (H - B) : 0;
    if (over > 0) for (const r of rows) r.labelY -= over;
    return rows;
  });

  /** A player picked to follow; the other lines fade. */
  let focus = $state<number | null>(null);
  /** The round being inspected (tap, hover or arrow keys). */
  let active = $state<number | null>(null);
  let svg = $state<SVGSVGElement>();

  function roundAt(e: PointerEvent): number {
    const box = svg!.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    return Math.min(rounds, Math.max(1, Math.round(((vx - L) / (W - L - R)) * rounds)));
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') active = Math.min(rounds, (active ?? 0) + 1);
    else if (e.key === 'ArrowLeft') active = Math.max(1, (active ?? rounds + 1) - 1);
    else if (e.key === 'Escape') active = null;
    else return;
    e.preventDefault();
  }

  /** Everyone's total after the inspected round, best first. */
  const tooltip = $derived(
    active === null
      ? null
      : series
          .flatMap((s, p) => (active! >= from(p) ? [{ p, total: s[active!] }] : []))
          .sort((a, b) => (low ? a.total - b.total : b.total - a.total)),
  );

  const summary = $derived(
    `Running totals by round. ${series
      .map((s, p) => ({ name: players[p].name, total: s[rounds] }))
      .sort((a, b) => (low ? a.total - b.total : b.total - a.total))
      .map((r) => `${r.name} ${num.format(r.total)}`)
      .join(', ')}.`,
  );
</script>

{#if rounds >= 2}
  <section class="race" aria-label="Score race">
    <div class="head">
      <h2>Score race</h2>
      <span class="hint">{low ? 'Lower is better' : 'Higher is better'}</span>
    </div>
    <div class="chips">
      {#each players as p, i (p.seat)}
        <button
          type="button"
          class="chip"
          aria-pressed={focus === i}
          onclick={() => (focus = focus === i ? null : i)}
        >
          <Avatar name={p.name} seat={p.seat} emoji={p.emoji} size={22} />
          {p.name}
        </button>
      {/each}
    </div>

    <div class="plot">
      <!-- A picture with a keyboard cursor: arrow keys pick a round, read out in the tooltip. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <svg
        bind:this={svg}
        viewBox="0 0 {W} {H}"
        role="img"
        aria-label={summary}
        tabindex="0"
        {onkeydown}
        onpointerdown={(e) => (active = roundAt(e))}
        onpointermove={(e) => e.pointerType === 'mouse' && (active = roundAt(e))}
        onpointerleave={(e) => e.pointerType === 'mouse' && (active = null)}
        onblur={() => (active = null)}
      >
        {#each scale.ticks as t (t)}
          <line class={t === 0 ? 'base' : 'grid'} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text class="axis" x={L - 6} y={y(t) + 3.5} text-anchor="end">{compact.format(t)}</text>
        {/each}
        <text class="axis" x={L} y={H - 6} text-anchor="middle">Start</text>
        {#each xTicks as i (i)}
          <text class="axis" x={x(i)} y={H - 6} text-anchor="middle">{i}</text>
        {/each}

        {#if active !== null}
          <line class="cross" x1={x(active)} x2={x(active)} y1={T} y2={H - B} />
        {/if}

        {#each series as s, p (p)}
          {#if p !== focus}
            <polyline
              class="line"
              class:faded={focus !== null}
              stroke={seatColor(p)}
              points={pointsFor(s, p)}
            />
          {/if}
        {/each}
        {#if focus !== null}
          <polyline class="line" stroke={seatColor(focus)} points={pointsFor(series[focus], focus)} />
        {/if}

        {#each series as s, p (p)}
          {#if focus === null || focus === p}
            <circle class="dot" cx={x(rounds)} cy={y(s[rounds])} r="4.5" fill={seatColor(p)} />
            {#if active !== null && active >= from(p)}
              <circle class="dot" cx={x(active)} cy={y(s[active])} r="4.5" fill={seatColor(p)} />
            {/if}
          {/if}
        {/each}

        {#each endLabels as l (l.p)}
          <text class="end" class:faded={focus !== null && focus !== l.p} x={x(rounds) + 9} y={l.labelY + 4}>
            {shortName(players[l.p].name)}
          </text>
        {/each}
      </svg>

      {#if tooltip && active !== null}
        <div
          class="tip"
          class:flip={x(active) > (W - R) / 2}
          style:left="{(x(active) / W) * 100}%"
          aria-live="polite"
        >
          <p>After round {active}</p>
          {#each tooltip as t (t.p)}
            <div class="tip-row">
              <span class="swatch" style:background={seatColor(t.p)}></span>
              <span class="tip-name">{players[t.p].name}</span>
              <strong>{num.format(t.total)}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <p class="hint">Tap a name to follow one player. Tap the chart to see a round’s totals.</p>
  </section>
{/if}

<style>
  .race {
    margin-top: 16px;
    padding: 16px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 36px;
    padding: 0 12px 0 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--amber);
  }
  .plot {
    position: relative;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    cursor: crosshair;
    font-family: inherit;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .base {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .cross {
    stroke: var(--line-strong);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .axis {
    fill: var(--muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .faded {
    opacity: 0.3;
  }
  .dot {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .end {
    fill: var(--text);
    font-size: 11px;
    font-weight: 700;
  }
  .tip {
    position: absolute;
    top: 4px;
    margin-left: 10px;
    min-width: 130px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    font-size: 12px;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tip.flip {
    transform: translateX(-100%);
    margin-left: -10px;
  }
  .tip p {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tip-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .swatch {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
  }
  .tip-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
