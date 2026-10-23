import { describe, expect, it } from 'vitest';
import { fiveCrowns } from '../games/fiveCrowns';
import { assignPeople, canonicalId, matchesFor, peopleAfterGame, savedPlayers } from './people';
import { createSession } from './session';
import type { Person } from './types';

describe('saved players', () => {
  it('gives games from before lasting ids one id per name', () => {
    const a = { ...createSession(fiveCrowns, ['Maya', 'Leo'], undefined, 1), finishedAt: 5 };
    const b = { ...createSession(fiveCrowns, [{ name: 'maya ', emoji: '🦊' }, 'Sam'], undefined, 10), finishedAt: 20 };
    const { sessions, people } = assignPeople([b, a], []);
    expect(sessions).toHaveLength(2);
    const ids = (i: number) => sessions.find((s) => s.id === [a, b][i].id)!.players.map((p) => p.personId);
    expect(ids(0)[0]).toBe(ids(1)[0]);
    expect(ids(0)[1]).not.toBe(ids(1)[1]);
    // The newest game's spelling and emoji win.
    expect(people.find((p) => p.id === ids(0)[0])).toMatchObject({ name: 'maya', emoji: '🦊', lastPlayed: 20 });
    expect(people).toHaveLength(3);
  });

  it('matches restored players to saved ones by name, and keeps ids already set', () => {
    const saved: Person[] = [{ id: 'p-maya', name: 'Maya', lastPlayed: 1 }];
    const s = createSession(fiveCrowns, ['Maya', { name: 'Ana', personId: 'phone-ana-1' }]);
    const { sessions, people } = assignPeople([s], saved);
    expect(sessions[0].players.map((p) => p.personId)).toEqual(['p-maya', 'phone-ana-1']);
    expect(people.map((p) => p.id)).toEqual(['phone-ana-1']);
  });

  it('follows merges and leaves merged players out of the picks', () => {
    const people: Person[] = [
      { id: 'a', name: 'Maya', lastPlayed: 1 },
      { id: 'b', name: 'maya', lastPlayed: 3, mergedInto: 'a' },
      { id: 'c', name: 'Maya', lastPlayed: 2 },
    ];
    const byId = new Map(people.map((p) => [p.id, p]));
    expect(canonicalId('b', byId)).toBe('a');
    expect(canonicalId('zzz', byId)).toBe('zzz');
    expect(savedPlayers(people).map((p) => p.id)).toEqual(['c', 'a']);
    expect(matchesFor(' MAYA', people).map((p) => p.id)).toEqual(['c', 'a']);
    expect(matchesFor('', people)).toEqual([]);
  });

  it('survives a merge loop', () => {
    const people: Person[] = [
      { id: 'a', name: 'A', lastPlayed: 1, mergedInto: 'b' },
      { id: 'b', name: 'B', lastPlayed: 1, mergedInto: 'a' },
    ];
    expect(['a', 'b']).toContain(canonicalId('a', new Map(people.map((p) => [p.id, p]))));
  });

  it('updates saved players after a game, keeping merges', () => {
    const s = createSession(fiveCrowns, [{ name: 'Maya', emoji: '🦊', personId: 'b' }, { name: 'Leo', personId: 'n' }]);
    const out = peopleAfterGame(s.players, [{ id: 'b', name: 'MAYA', lastPlayed: 1, mergedInto: 'a' }], 50);
    expect(out).toEqual([
      { id: 'b', name: 'MAYA', emoji: '🦊', lastPlayed: 50, mergedInto: 'a' },
      { id: 'n', name: 'Leo', lastPlayed: 50 },
    ]);
  });
});
