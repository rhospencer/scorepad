/**
 * Avatars players can pick, grouped for the picker. Shared by the phone join
 * screen, player setup, and the lobby server (which only accepts these).
 * Single-codepoint emoji that always draw in color (no text-style symbols like ☀ or ♟).
 */
export const EMOJI_GROUPS: { name: string; emoji: string[] }[] = [
  {
    name: 'Animals',
    emoji: [
      '🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐵', '🐧', '🦁', '🐨', '🐰', '🐻',
      '🐲', '🦖', '🐢', '🦉', '🐶', '🐱', '🐭', '🐹', '🐮', '🐷', '🐔', '🦆',
      '🦅', '🐺', '🐗', '🐴', '🐝', '🦋', '🐌', '🐞', '🦀', '🦑', '🐬', '🐳',
      '🦈', '🐊', '🦓', '🦒', '🦘', '🦥', '🦦', '🦔', '🦩', '🦜', '🦝', '🦇',
    ],
  },
  {
    name: 'Food',
    emoji: [
      '🍕', '🌮', '🍩', '🍉', '🍔', '🍟', '🌭', '🍿', '🧁', '🍪', '🍫', '🍭',
      '🍦', '🍰', '🥨', '🥑', '🍓', '🍒', '🍍', '🥥', '🍋', '🍌', '🍇', '🥕',
      '🥐', '🧀', '🥓', '🍣', '🍜', '🥟', '☕', '🧋',
    ],
  },
  {
    name: 'Faces',
    emoji: [
      '😀', '😎', '🤓', '🤠', '🥳', '😇', '🤪', '😜', '🤩', '😏', '🥶', '🥵',
      '😈', '🤡', '💀', '🤖', '👻', '👽', '👾', '🎃', '🦸', '🦹', '🧙', '🧛',
      '🧜', '🧚', '🥷', '🧞',
    ],
  },
  {
    name: 'Games',
    emoji: [
      '🎲', '🎯', '🃏', '🀄', '🎰', '🎮', '🪀', '🧩', '🎳', '🎱', '⚽', '🏀',
      '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '⛳', '🏆', '🥇', '🎣', '🛹',
    ],
  },
  {
    name: 'Nature',
    emoji: [
      '⭐', '🌈', '🔥', '⚡', '🌙', '🌞', '🌊', '⛄', '🌵', '🌻', '🌸', '🍀',
      '🍄', '🌴', '🌋', '🪐', '🌠', '🌍',
    ],
  },
  {
    name: 'Things',
    emoji: [
      '🚀', '👑', '🎸', '🥁', '🎺', '🎨', '🎩', '🧭', '💎', '🔮', '🧲', '💡',
      '🎈', '🎁', '🪄', '⚓', '🛸', '🚂', '🚁', '🚲', '⛵', '🗿', '🏰', '🧸',
    ],
  },
];

/** Every avatar, in picker order. */
export const EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emoji);

const ALLOWED = new Set(EMOJIS);

export function isAvatarEmoji(value: unknown): value is string {
  return typeof value === 'string' && ALLOWED.has(value);
}

/** A random emoji, avoiding the ones in `taken` while any are left. */
export function randomEmoji(taken: Iterable<string | undefined> = [], rand = Math.random): string {
  const used = new Set(taken);
  const free = EMOJIS.filter((e) => !used.has(e));
  const pool = free.length > 0 ? free : EMOJIS;
  return pool[Math.floor(rand() * pool.length)];
}
