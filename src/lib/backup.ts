import type { CustomGameSpec, Person, Session } from './types';

/** Everything Scorepad keeps on a device, as one file. */
export interface Backup {
  app: 'scorepad';
  version: 1;
  savedAt: number;
  sessions: Session[];
  customGames: CustomGameSpec[];
  /** Saved players (missing from backups made before players had lasting ids). */
  people: Person[];
}

/** What restoring a backup would add. Restoring never changes or deletes anything already here. */
export interface RestorePlan {
  sessions: Session[];
  customGames: CustomGameSpec[];
  people: Person[];
  /** Games and custom games in the file that this device already has. */
  existing: number;
}

const LAST_KEY = 'scorepad:last-backup';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): Store | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function makeBackup(
  sessions: Session[],
  customGames: CustomGameSpec[],
  people: Person[],
  now = Date.now(),
): Backup {
  return JSON.parse(JSON.stringify({ app: 'scorepad', version: 1, savedAt: now, sessions, customGames, people })) as Backup;
}

/** e.g. scorepad-backup-2026-10-23.json, in local time. */
export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `scorepad-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isSession(v: unknown): v is Session {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.gameId === 'string' &&
    typeof v.startedAt === 'number' &&
    Array.isArray(v.players) &&
    v.players.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string') &&
    Array.isArray(v.scores) &&
    v.scores.every((r) => Array.isArray(r) && r.every((n) => typeof n === 'number'))
  );
}

function isPerson(v: unknown): v is Person {
  return isObject(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.lastPlayed === 'number';
}

function isCustomGame(v: unknown): v is CustomGameSpec {
  return isObject(v) && typeof v.id === 'string' && v.id.startsWith('custom-') && typeof v.name === 'string';
}

/** The backup in a file's text, or null if it isn't a Scorepad backup. Damaged entries are dropped. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.app !== 'scorepad' || !Array.isArray(raw.sessions)) return null;
  return {
    app: 'scorepad',
    version: 1,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    sessions: raw.sessions.filter(isSession),
    customGames: Array.isArray(raw.customGames) ? raw.customGames.filter(isCustomGame) : [],
    people: Array.isArray(raw.people) ? raw.people.filter(isPerson) : [],
  };
}

export function planRestore(
  backup: Backup,
  sessionIds: Set<string>,
  customIds: Set<string>,
  personIds: Set<string>,
): RestorePlan {
  const sessions = backup.sessions.filter((s) => !sessionIds.has(s.id));
  const customGames = backup.customGames.filter((g) => !customIds.has(g.id));
  const people = backup.people.filter((p) => !personIds.has(p.id));
  const existing = backup.sessions.length - sessions.length + backup.customGames.length - customGames.length;
  return { sessions, customGames, people, existing };
}

/** When this device last saved a backup file, if ever. */
export function lastBackupAt(storage: Store | undefined = safeStorage()): number | null {
  try {
    const n = Number(storage?.getItem(LAST_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function rememberBackup(now = Date.now(), storage: Store | undefined = safeStorage()): void {
  try {
    storage?.setItem(LAST_KEY, String(now));
  } catch {
    // Private mode: the reminder just says "never".
  }
}

/** Games finished since the last backup (all of them if there wasn't one). */
export function finishedSince(sessions: Session[], since: number | null): number {
  return sessions.filter((s) => s.finishedAt && s.finishedAt > (since ?? 0)).length;
}
