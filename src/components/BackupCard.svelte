<script lang="ts">
  import { onMount } from 'svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import {
    backupFileName,
    finishedSince,
    lastBackupAt,
    makeBackup,
    parseBackup,
    planRestore,
    rememberBackup,
    type RestorePlan,
  } from '../lib/backup';
  import { addRestored, allPeople, allSessions, customGames } from '../lib/db';
  import type { Session } from '../lib/types';

  interface Props {
    /** Called after a restore adds games, so the lists reload. */
    onrestored: () => void;
  }

  let { onrestored }: Props = $props();

  const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

  let sessions = $state<Session[]>([]);
  let last = $state<number | null>(lastBackupAt());
  /** A line under the buttons after a backup or restore, or when a file can't be read. */
  let status = $state('');
  let fileInput = $state<HTMLInputElement>();
  let plan = $state<RestorePlan | null>(null);
  let planFrom = $state('');

  onMount(() => {
    allSessions()
      .then((all) => (sessions = all))
      .catch(() => {});
  });

  const since = $derived(finishedSince(sessions, last));
  const lastLine = $derived(
    last ? `Last backup: ${dateFmt.format(last)} · ${since} ${since === 1 ? 'game' : 'games'} since` : 'Not backed up yet',
  );

  async function backUp() {
    try {
      const [all, customs, people] = await Promise.all([allSessions(), customGames(), allPeople()]);
      const now = Date.now();
      const blob = new Blob([JSON.stringify(makeBackup(all, customs, people, now))], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(now);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      rememberBackup(now);
      last = now;
      sessions = all;
      status = `Saved ${all.length} ${all.length === 1 ? 'game' : 'games'} and ${customs.length} custom ${customs.length === 1 ? 'game' : 'games'}.`;
    } catch {
      status = 'Couldn’t make the backup file.';
    }
  }

  async function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const backup = parseBackup(await file.text());
    if (!backup) {
      status = 'That file isn’t a Scorepad backup.';
      return;
    }
    const [all, customs, people] = await Promise.all([allSessions(), customGames(), allPeople()]);
    const next = planRestore(
      backup,
      new Set(all.map((s) => s.id)),
      new Set(customs.map((g) => g.id)),
      new Set(people.map((p) => p.id)),
    );
    if (next.sessions.length + next.customGames.length === 0) {
      status = 'Everything in that backup is already on this device.';
      return;
    }
    planFrom = backup.savedAt ? `${file.name} · saved ${dateFmt.format(backup.savedAt)}` : file.name;
    plan = next;
  }

  const adding = $derived(plan ? plan.sessions.length + plan.customGames.length : 0);
  const rows = $derived(
    plan
      ? [
          { label: 'New finished games', value: plan.sessions.filter((s) => s.finishedAt).length },
          { label: 'New games in progress', value: plan.sessions.filter((s) => !s.finishedAt).length },
          { label: 'New custom games', value: plan.customGames.length },
          { label: 'Already on this device', value: plan.existing, muted: true },
        ].filter((r) => r.value > 0)
      : [],
  );

  async function restore() {
    const p = plan;
    const count = adding;
    plan = null;
    if (!p) return;
    try {
      await addRestored(p.sessions, p.customGames, p.people);
      sessions = await allSessions();
      status = `Added ${count} ${count === 1 ? 'item' : 'items'} from the backup.`;
      onrestored();
    } catch {
      status = 'Couldn’t restore that backup.';
    }
  }
</script>

<div class="data">
  <p class="lead">Scores are saved only in this browser. Back up to a file to keep them safe or move them to another device.</p>
  <div class="buttons">
    <button type="button" class="btn btn-primary" onclick={backUp}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
      Back up
    </button>
    <button type="button" class="btn" onclick={() => fileInput?.click()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
      Restore
    </button>
  </div>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={pickFile} />
  <p class="last" aria-live="polite">{status || lastLine}</p>
</div>

<ConfirmDialog
  open={plan !== null}
  title="Restore this backup?"
  message={planFrom}
  confirmLabel="Add {adding} {adding === 1 ? 'item' : 'items'}"
  onconfirm={restore}
  oncancel={() => (plan = null)}
>
  <dl class="summary">
    {#each rows as r (r.label)}
      <div class:muted={r.muted}>
        <dt>{r.label}</dt>
        <dd>{r.value}</dd>
      </div>
    {/each}
  </dl>
  <p class="safe">Restoring only adds. Nothing on this device is changed or deleted.</p>
</ConfirmDialog>

<style>
  .data {
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lead,
  .last,
  .safe {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }
  .last {
    font-size: 13px;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .buttons .btn {
    min-height: 48px;
    font-size: 16px;
  }
  .summary {
    margin: 8px 0 4px;
    border-radius: 16px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .summary div {
    min-height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .summary div + div {
    border-top: 1px solid var(--line);
  }
  .summary .muted {
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
  }
</style>
