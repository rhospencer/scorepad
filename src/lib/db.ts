import Dexie, { type EntityTable } from 'dexie';
import type { CustomGameSpec, Session } from './types';

/** Local-only storage (IndexedDB). Nothing leaves the device. */
export const db = new Dexie('scorepad') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  customGames: EntityTable<CustomGameSpec, 'id'>;
};

db.version(1).stores({
  sessions: 'id, gameId, startedAt, finishedAt',
});
// Games built in the app.
db.version(2).stores({
  sessions: 'id, gameId, startedAt, finishedAt',
  customGames: 'id, updatedAt',
});

/** Games built in the app, oldest first (the order they were made). */
export async function customGames(): Promise<CustomGameSpec[]> {
  return db.customGames.toArray().then((all) => all.sort((a, b) => a.createdAt - b.createdAt));
}

export async function saveCustomGame(spec: CustomGameSpec): Promise<void> {
  await db.customGames.put(JSON.parse(JSON.stringify(spec)) as CustomGameSpec);
}

/** Past games made from it keep their own copy of the rules. */
export async function deleteCustomGame(id: string): Promise<void> {
  await db.customGames.delete(id);
}

/**
 * Save a session (insert or replace). Takes a plain copy first, because
 * IndexedDB can't store Svelte's reactive proxies.
 */
export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put(JSON.parse(JSON.stringify(session)) as Session);
}

export async function loadSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id);
  return s && normalize(s);
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

/** Unfinished games, newest first. */
export async function inProgressSessions(): Promise<Session[]> {
  const all = await db.sessions.orderBy('startedAt').reverse().filter((s) => !s.finishedAt).toArray();
  return all.map(normalize);
}

/** Finished games, most recently finished first. */
export async function finishedSessions(limit = 20): Promise<Session[]> {
  const all = await db.sessions.where('finishedAt').above(0).reverse().sortBy('finishedAt');
  return all.slice(0, limit).map(normalize);
}

/** Fill in fields that older saved sessions may not have. */
function normalize(s: Session): Session {
  return { ...s, outs: s.outs ?? s.scores.map(() => null) };
}
