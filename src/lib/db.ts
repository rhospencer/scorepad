import Dexie, { type EntityTable } from 'dexie';
import { assignPeople } from './people';
import type { CustomGameSpec, Person, Session } from './types';

/** Local-only storage (IndexedDB). Nothing leaves the device. */
export const db = new Dexie('scorepad') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  customGames: EntityTable<CustomGameSpec, 'id'>;
  people: EntityTable<Person, 'id'>;
};

db.version(1).stores({
  sessions: 'id, gameId, startedAt, finishedAt',
});
// Games built in the app.
db.version(2).stores({
  sessions: 'id, gameId, startedAt, finishedAt',
  customGames: 'id, updatedAt',
});
// Saved players. Games from before give each name one lasting id, so records carry over.
db.version(3)
  .stores({
    sessions: 'id, gameId, startedAt, finishedAt',
    customGames: 'id, updatedAt',
    people: 'id, lastPlayed',
  })
  .upgrade(async (tx) => {
    const sessions = await tx.table<Session, string>('sessions').toArray();
    const assigned = assignPeople(sessions, []);
    await tx.table<Session, string>('sessions').bulkPut(assigned.sessions);
    await tx.table<Person, string>('people').bulkPut(assigned.people);
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

/** Every saved game, finished or not, for a backup file. */
export async function allSessions(): Promise<Session[]> {
  return db.sessions.toArray();
}

/**
 * Add games, custom games and saved players from a backup. Only new ids are passed in,
 * so nothing here is overwritten. Players in older backups are matched to saved players by name.
 */
export async function addRestored(sessions: Session[], games: CustomGameSpec[], people: Person[]): Promise<void> {
  // Plain copies, as in saveSession: the plan may be held in Svelte state.
  const plain = JSON.parse(JSON.stringify({ sessions, games, people })) as {
    sessions: Session[];
    games: CustomGameSpec[];
    people: Person[];
  };
  await db.transaction('rw', db.sessions, db.customGames, db.people, async () => {
    const known = [...(await db.people.toArray()), ...plain.people];
    const assigned = assignPeople(plain.sessions, known);
    const fixed = new Map(assigned.sessions.map((s) => [s.id, s]));
    await db.sessions.bulkAdd(plain.sessions.map((s) => fixed.get(s.id) ?? s));
    await db.customGames.bulkAdd(plain.games);
    await db.people.bulkAdd([...plain.people, ...assigned.people]);
  });
}

export async function allPeople(): Promise<Person[]> {
  return db.people.toArray();
}

export async function savePeople(people: Person[]): Promise<void> {
  await db.people.bulkPut(JSON.parse(JSON.stringify(people)) as Person[]);
}

/** Fill in fields that older saved sessions may not have. */
function normalize(s: Session): Session {
  return { ...s, outs: s.outs ?? s.scores.map(() => null) };
}
