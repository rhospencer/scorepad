import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, EMOJIS, isAvatarEmoji, randomEmoji } from './emoji';
import { createSession } from './session';
import { farkle } from '../games/farkle';

describe('avatar emoji', () => {
  it('has lots of choices, each once, in every group', () => {
    expect(EMOJIS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length);
    for (const g of EMOJI_GROUPS) expect(g.emoji.length).toBeGreaterThan(0);
  });

  it('keeps every emoji a single character that draws in color', () => {
    for (const e of EMOJIS) {
      expect([...e]).toHaveLength(1);
      expect(e).toMatch(/\p{Emoji_Presentation}/u);
    }
  });

  it('only accepts emoji from the list', () => {
    expect(isAvatarEmoji('🦊')).toBe(true);
    expect(isAvatarEmoji('💩')).toBe(false);
    expect(isAvatarEmoji(42)).toBe(false);
  });

  it('picks a random emoji nobody has yet', () => {
    const taken = EMOJIS.slice(1);
    expect(randomEmoji(taken)).toBe(EMOJIS[0]);
  });

  it('still picks one when every emoji is taken', () => {
    expect(EMOJIS).toContain(randomEmoji(EMOJIS));
  });
});

describe('players with emoji', () => {
  it('keeps each player’s emoji and leaves it off when there is none', () => {
    const s = createSession(farkle, [{ name: 'Ana', emoji: '🦊' }, { name: ' Ben ' }, 'Cy']);
    expect(s.players.map(({ name, emoji }) => ({ name, emoji }))).toEqual([
      { name: 'Ana', emoji: '🦊' },
      { name: 'Ben', emoji: undefined },
      { name: 'Cy', emoji: undefined },
    ]);
    expect('emoji' in s.players[1]).toBe(false);
  });
});
