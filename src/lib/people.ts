import type { Person, Player, Session } from './types';

/** Names match ignoring case and spaces at either end. */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function newPersonId(): string {
  return crypto.randomUUID();
}

/** People who haven't been merged into someone else, most recently played first. */
export function savedPlayers(people: Person[]): Person[] {
  return people.filter((p) => !p.mergedInto).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

/** Saved players with this name, most recently played first. */
export function matchesFor(name: string, people: Person[]): Person[] {
  const key = nameKey(name);
  return key ? savedPlayers(people).filter((p) => nameKey(p.name) === key) : [];
}

/** The person an id stands for after merges. */
export function canonicalId(id: string, byId: Map<string, Person>): string {
  const seen = new Set<string>();
  let at = id;
  while (!seen.has(at)) {
    seen.add(at);
    const next = byId.get(at)?.mergedInto;
    if (!next) break;
    at = next;
  }
  return at;
}

/**
 * Give every player without a lasting id one: the saved player with their name if there
 * is one, else a new person (shared by everyone with that name in these games). Also
 * saves anyone whose id isn't known yet, such as phones in a restored backup.
 * Used once for games saved before ids existed, and for restored backups.
 */
export function assignPeople(sessions: Session[], people: Person[]): { sessions: Session[]; people: Person[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const added = new Map<string, Person>();
  const byName = new Map<string, string>();
  for (const p of savedPlayers(people)) if (!byName.has(nameKey(p.name))) byName.set(nameKey(p.name), p.id);

  const changed: Session[] = [];
  // Oldest first, so each new person's name and emoji end up as in their latest game.
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const when = s.finishedAt ?? s.startedAt;
    let edited = false;
    const players = s.players.map((p): Player => {
      let id = p.personId;
      if (!id) {
        const key = nameKey(p.name);
        id = byName.get(key) ?? newPersonId();
        byName.set(key, id);
        edited = true;
      }
      if (!byId.has(id)) {
        const prev = added.get(id);
        if (!prev || prev.lastPlayed <= when) {
          added.set(id, { id, name: p.name, ...(p.emoji ? { emoji: p.emoji } : {}), lastPlayed: when });
        }
      }
      return id === p.personId ? p : { ...p, personId: id };
    });
    if (edited) changed.push({ ...s, players });
  }
  return { sessions: changed, people: [...added.values()] };
}

/** Saved-player entries to write after a game starts: new people, and fresh names, emoji and dates. */
export function peopleAfterGame(players: Player[], people: Person[], now = Date.now()): Person[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return players
    .filter((p) => p.personId)
    .map((p) => {
      const was = byId.get(p.personId!);
      const emoji = p.emoji ? { emoji: p.emoji } : {};
      const merged = was?.mergedInto ? { mergedInto: was.mergedInto } : {};
      // "sam" typed for a saved "Sam" keeps the saved spelling; a real rename sticks.
      const name = was && nameKey(was.name) === nameKey(p.name) ? was.name : p.name;
      return { id: p.personId!, name, ...emoji, lastPlayed: now, ...merged };
    });
}
