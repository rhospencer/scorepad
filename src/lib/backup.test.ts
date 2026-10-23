import { describe, expect, it } from 'vitest';
import { fiveCrowns } from '../games/fiveCrowns';
import { backupFileName, finishedSince, lastBackupAt, makeBackup, parseBackup, planRestore, rememberBackup } from './backup';
import { blankSpec } from './customGame';
import { createSession } from './session';

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('backups', () => {
  const a = createSession(fiveCrowns, ['Alex', 'Sam']);
  const b = { ...createSession(fiveCrowns, ['Alex', 'Sam']), finishedAt: 2000 };
  const custom = blankSpec(1000);

  it('round-trips through a file', () => {
    const backup = makeBackup([a, b], [custom], [{ id: 'person-1', name: 'Alex', lastPlayed: 1 }], 5000);
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects files that are not Scorepad backups', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"sessions":[]}')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
  });

  it('drops damaged entries and keeps the rest', () => {
    const text = JSON.stringify({ app: 'scorepad', sessions: [a, { id: 'x' }], customGames: [custom, { id: 'nope' }] });
    const parsed = parseBackup(text)!;
    expect(parsed.sessions.map((s) => s.id)).toEqual([a.id]);
    expect(parsed.customGames.map((g) => g.id)).toEqual([custom.id]);
  });

  it('restores only what the device is missing', () => {
    const people = [
      { id: 'person-1', name: 'Alex', lastPlayed: 1 },
      { id: 'person-2', name: 'Sam', lastPlayed: 1 },
    ];
    const plan = planRestore(makeBackup([a, b], [custom], people), new Set([a.id]), new Set(), new Set(['person-1']));
    expect(plan.people.map((p) => p.id)).toEqual(['person-2']);
    expect(plan.sessions.map((s) => s.id)).toEqual([b.id]);
    expect(plan.customGames).toHaveLength(1);
    expect(plan.existing).toBe(1);
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 9, 3).getTime())).toBe('scorepad-backup-2026-10-03.json');
  });

  it('remembers the last backup and counts games finished since', () => {
    const store = memoryStore();
    expect(lastBackupAt(store)).toBeNull();
    rememberBackup(1500, store);
    expect(lastBackupAt(store)).toBe(1500);
    expect(finishedSince([a, b], 1500)).toBe(1);
    expect(finishedSince([a, b], 2500)).toBe(0);
    expect(finishedSince([a, b], null)).toBe(1);
  });
});
