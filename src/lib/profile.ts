import { isAvatarEmoji } from './emoji';

/** What a phone remembers about its owner between games: their name and avatar. */
export interface Profile {
  name: string;
  emoji: string;
}

const KEY = 'scorepad:profile';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): Store | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** The saved profile, or null when there isn't a valid one (or storage is blocked). */
export function loadProfile(storage: Store | undefined = safeStorage()): Profile | null {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 20) : '';
    if (!name || !isAvatarEmoji(raw?.emoji)) return null;
    return { name, emoji: raw!.emoji as string };
  } catch {
    return null;
  }
}

/** Remember the name and avatar this phone last played as. */
export function saveProfile(profile: Profile, storage: Store | undefined = safeStorage()): void {
  const name = profile.name.trim().slice(0, 20);
  if (!name || !isAvatarEmoji(profile.emoji)) return;
  try {
    storage?.setItem(KEY, JSON.stringify({ name, emoji: profile.emoji }));
  } catch {
    // Private mode: they'll just type it again next time.
  }
}

const ID_KEY = 'scorepad:person-id';

/**
 * This phone's lasting player id, made on first use. Sent when joining a game so the
 * host's records follow this player even if someone else has the same name.
 * Null when storage is blocked: the host then treats them like a typed-in player.
 */
export function personId(storage: Store | undefined = safeStorage()): string | null {
  try {
    const saved = storage?.getItem(ID_KEY);
    if (saved && /^[\w-]{8,64}$/.test(saved)) return saved;
    if (!storage) return null;
    const id = crypto.randomUUID();
    storage.setItem(ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}
