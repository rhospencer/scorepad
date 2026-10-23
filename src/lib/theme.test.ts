import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isThemeChoice, loadTheme, resolveTheme, saveTheme, THEMES } from './theme';

/** Theme tokens parsed from themes.css, by theme id. */
function themeTokens(): Record<string, Record<string, string>> {
  const css = readFileSync(new URL('../themes.css', import.meta.url), 'utf8');
  const out: Record<string, Record<string, string>> = {};
  for (const block of css.matchAll(/\[data-theme='([a-z]+)'\]\s*\{([^}]*)\}/g)) {
    out[block[1]] = Object.fromEntries([...block[2].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TOKENS = ['bg', 'surface', 'surface-2', 'line', 'line-strong', 'text', 'muted', 'amber', 'on-amber', 'teal', 'on-teal', 'coral', 'coral-text', 'avatar-ink'];

/** [foreground, background, minimum ratio]: text 4.5:1, control borders 3:1. */
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface-2', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'surface-2', 4.5],
  ['amber', 'bg', 4.5],
  ['amber', 'surface', 4.5],
  ['amber', 'surface-2', 4.5],
  ['on-amber', 'amber', 4.5],
  ['teal', 'bg', 4.5],
  ['teal', 'surface', 4.5],
  ['on-teal', 'teal', 4.5],
  ['coral', 'surface', 4.5],
  ['coral-text', 'bg', 4.5],
  ['line-strong', 'surface', 3],
];

describe('themes', () => {
  const tokens = themeTokens();

  it('defines every token for every theme in the list', () => {
    for (const t of THEMES) expect(Object.keys(tokens[t.id] ?? {}).sort()).toEqual([...TOKENS].sort());
  });

  for (const t of THEMES) {
    it(`${t.name} meets contrast minimums`, () => {
      const p = tokens[t.id];
      const fails = PAIRS.filter(([fg, bg, min]) => contrast(p[fg], p[bg]) < min).map(
        ([fg, bg]) => `${fg} on ${bg}: ${contrast(p[fg], p[bg]).toFixed(2)}`,
      );
      expect(fails).toEqual([]);
    });
  }

  it('follows the device for "system"', () => {
    expect(resolveTheme('system', true)).toBe('daylight');
    expect(resolveTheme('system', false)).toBe('midnight');
    expect(resolveTheme('felt', true)).toBe('felt');
  });

  it('saves and loads the choice, ignoring junk', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(loadTheme(storage)).toBe('system');
    saveTheme('felt', storage);
    expect(loadTheme(storage)).toBe('felt');
    store.set('scorepad:theme', 'neon');
    expect(loadTheme(storage)).toBe('system');
    expect(isThemeChoice('contrast')).toBe(true);
  });

  it('falls back to "system" when storage throws', () => {
    expect(loadTheme({ getItem: () => { throw new Error('blocked'); } })).toBe('system');
  });
});
