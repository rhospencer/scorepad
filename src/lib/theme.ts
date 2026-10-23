/** The color themes in src/themes.css. Each device (host or phone) keeps its own choice. */
export const THEMES = [
  { id: 'midnight', name: 'Midnight', blurb: 'Dark navy, amber accents' },
  { id: 'daylight', name: 'Daylight', blurb: 'Light and bright for sunny tables' },
  { id: 'felt', name: 'Card table', blurb: 'Green felt and gold' },
  { id: 'contrast', name: 'High contrast', blurb: 'Black, white and yellow' },
  // Team palettes, named after a nod to the team rather than the team.
  { id: 'royal', name: 'Rise & Shout', blurb: 'Royal blue and white' },
  { id: 'iceage', name: 'Tusks Up', blurb: 'Rock black, salt white, mountain blue' },
  { id: 'bebop', name: 'Take Note', blurb: 'Mountain purple and sky blue' },
  { id: 'greenwall', name: 'Green Wall', blurb: 'Neon green on black' },
  { id: 'ibelieve', name: 'I Believe', blurb: 'Navy, red and white' },
  { id: 'paper', name: 'Scratch Paper', blurb: 'Cream notepad, red-pen accent' },
  { id: 'sakura', name: 'Sakura', blurb: 'Blossom pink, deep rose accent' },
  { id: 'pocket', name: 'Pocket', blurb: 'Olive greens like an old handheld' },
  { id: 'redrock', name: 'Red Rock', blurb: 'Desert sandstone, burnt orange' },
  { id: 'arcade', name: 'Arcade', blurb: 'Hot pink and electric cyan' },
  { id: 'highroller', name: 'High Roller', blurb: 'Casino red felt and gold' },
  { id: 'tidepool', name: 'Tide Pool', blurb: 'Deep ocean teal, coral accent' },
  { id: 'espresso', name: 'Espresso', blurb: 'Coffee browns, caramel accent' },
  { id: 'graphite', name: 'Graphite', blurb: 'Grayscale with a blue accent' },
  { id: 'glacier', name: 'Glacier', blurb: 'Icy white with a deep blue accent' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
/** 'system' follows the device: Daylight in light mode, Midnight in dark mode. */
export type ThemeChoice = ThemeId | 'system';

const KEY = 'scorepad:theme';

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === 'system' || THEMES.some((t) => t.id === v);
}

/** The saved choice, or 'system' when nothing (valid) is saved or storage is blocked. */
export function loadTheme(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ThemeChoice {
  try {
    const saved = storage?.getItem(KEY);
    return isThemeChoice(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(choice: ThemeChoice, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, choice);
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
}

/** Which theme actually shows for a choice. */
export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): ThemeId {
  if (choice !== 'system') return choice;
  return prefersLight ? 'daylight' : 'midnight';
}

let unfollow: (() => void) | null = null;

/** Show a theme on this page and keep the browser bar color in step. 'system' tracks the device. */
export function applyTheme(choice: ThemeChoice): void {
  unfollow?.();
  unfollow = null;
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  const paint = () => {
    const id = resolveTheme(choice, media?.matches ?? false);
    document.documentElement.dataset.theme = id;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  };
  paint();
  if (choice === 'system' && media) {
    media.addEventListener('change', paint);
    unfollow = () => media.removeEventListener('change', paint);
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
