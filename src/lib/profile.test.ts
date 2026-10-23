import { describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profile';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('phone profile', () => {
  it('remembers the name and avatar between games', () => {
    const s = memory();
    expect(loadProfile(s)).toBeNull();
    saveProfile({ name: '  Spencer ', emoji: '🐙' }, s);
    expect(loadProfile(s)).toEqual({ name: 'Spencer', emoji: '🐙' });
  });

  it('ignores blank names, unknown emoji and junk', () => {
    const s = memory();
    saveProfile({ name: '   ', emoji: '🐙' }, s);
    saveProfile({ name: 'Ana', emoji: 'x' }, s);
    expect(loadProfile(s)).toBeNull();
    s.m.set('scorepad:profile', '{not json');
    expect(loadProfile(s)).toBeNull();
  });

  it('copes with blocked storage', () => {
    const blocked = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(loadProfile(blocked)).toBeNull();
    expect(() => saveProfile({ name: 'Ana', emoji: '🦊' }, blocked)).not.toThrow();
  });
});
