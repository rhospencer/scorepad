import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fiveCrowns } from '../games/fiveCrowns';
import { db, deleteSession, finishedSessions, inProgressSessions, loadSession, saveSession } from './db';
import { createSession, recordRound } from './session';

beforeEach(async () => {
  await db.sessions.clear();
});

describe('session storage', () => {
  it('saves and reloads a game in progress, including the unfinished round', async () => {
    let s = createSession(fiveCrowns, ['Ana', 'Ben'], undefined, 100);
    s = recordRound(fiveCrowns, s, 0, { entries: [0, 9], out: 0 });
    s = { ...s, draft: { entries: [4, null], out: null } };
    await saveSession(s);

    expect(await loadSession(s.id)).toEqual(s);
    expect((await inProgressSessions()).map((x) => x.id)).toEqual([s.id]);
    expect(await finishedSessions()).toEqual([]);
  });

  it('replaces the stored copy on each save', async () => {
    const s = createSession(fiveCrowns, ['Ana', 'Ben']);
    await saveSession(s);
    await saveSession({ ...s, scores: [[1, 2]], outs: [null] });
    expect((await loadSession(s.id))?.scores).toEqual([[1, 2]]);
    expect(await db.sessions.count()).toBe(1);
  });

  it('lists finished games newest first, separate from games in progress', async () => {
    const a = { ...createSession(fiveCrowns, ['A', 'B'], undefined, 1), finishedAt: 10 };
    const b = { ...createSession(fiveCrowns, ['A', 'B'], undefined, 2), finishedAt: 20 };
    const c = createSession(fiveCrowns, ['A', 'B'], undefined, 3);
    const d = createSession(fiveCrowns, ['A', 'B'], undefined, 4);
    for (const s of [a, b, c, d]) await saveSession(s);

    expect((await finishedSessions()).map((s) => s.id)).toEqual([b.id, a.id]);
    expect((await inProgressSessions()).map((s) => s.id)).toEqual([d.id, c.id]);
  });

  it('deletes a game', async () => {
    const s = createSession(fiveCrowns, ['A', 'B']);
    await saveSession(s);
    await deleteSession(s.id);
    expect(await loadSession(s.id)).toBeUndefined();
  });

  it('fills in missing fields on older saved games', async () => {
    const s = createSession(fiveCrowns, ['A', 'B']);
    const old = { ...s, scores: [[1, 2]], outs: undefined };
    await db.sessions.put(old as never);
    expect((await loadSession(s.id))?.outs).toEqual([null]);
  });
});
