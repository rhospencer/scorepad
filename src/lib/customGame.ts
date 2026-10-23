import type { CustomGameSpec, GameModule, RoundGridRules, RoundMeta, WinnerRule } from './types';

/** Limits the builder enforces, shared with the form. */
export const LIMITS = {
  name: 30,
  label: 16,
  rounds: 50,
  shortcuts: 8,
  notes: 12,
  note: 140,
  cheatSheet: 140,
  players: 20,
} as const;

export const KINDS = ['Card game', 'Dice game', 'Board game', 'Other'] as const;

export function isCustomId(id: string): boolean {
  return id.startsWith('custom-');
}

/** A fresh recipe: ten rounds, highest total wins. */
export function blankSpec(now = Date.now()): CustomGameSpec {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: '',
    icon: '🎲',
    kind: 'Card game',
    players: { min: 2, max: 6 },
    win: 'highest',
    end: 'rounds',
    rounds: 10,
    roundNames: null,
    target: 500,
    finalTurns: false,
    entryLabel: 'Points',
    allowNegative: false,
    bigNumbers: false,
    shortcuts: [],
    out: null,
    quick: null,
    rotateDealer: true,
    cheatSheet: '',
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** A copy with a new id, for "Make a copy". */
export function copySpec(spec: CustomGameSpec, now = Date.now()): CustomGameSpec {
  const name = `${spec.name} copy`.slice(0, LIMITS.name);
  return { ...(JSON.parse(JSON.stringify(spec)) as CustomGameSpec), id: blankSpec(now).id, name, createdAt: now, updatedAt: now };
}

/** Problems that stop the recipe being saved, by field. Empty when it's fine. */
export function specProblems(spec: CustomGameSpec): Record<string, string> {
  const out: Record<string, string> = {};
  const whole = (n: number) => Number.isInteger(n);
  if (!spec.name.trim()) out.name = 'Give the game a name.';
  if (!whole(spec.players.min) || spec.players.min < 1 || spec.players.min > LIMITS.players) {
    out.players = `Players start from 1 to ${LIMITS.players}.`;
  } else if (!whole(spec.players.max) || spec.players.max < spec.players.min || spec.players.max > LIMITS.players) {
    out.players = `The most players must be between ${spec.players.min} and ${LIMITS.players}.`;
  }
  if (spec.end === 'rounds' && (!whole(spec.rounds) || spec.rounds < 1 || spec.rounds > LIMITS.rounds)) {
    out.rounds = `Pick 1 to ${LIMITS.rounds} rounds.`;
  }
  if (spec.end === 'target' && (!whole(spec.target) || spec.target < 1 || spec.target > maxScore(spec))) {
    out.target = `Pick a target score from 1 to ${maxScore(spec).toLocaleString('en-US')}.`;
  }
  if (!spec.entryLabel.trim()) out.entryLabel = 'Say what players enter, like “Points”.';
  if (spec.out && !spec.out.label.trim()) out.out = 'Give the button a label.';
  if (spec.quick && !spec.quick.label.trim()) out.quick = 'Give the button a label.';
  if (spec.shortcuts.some((v) => !whole(v) || v === 0)) out.shortcuts = 'Shortcut buttons need a whole number other than 0.';
  return out;
}

function maxScore(spec: CustomGameSpec): number {
  return spec.bigNumbers ? 9_999_999 : 99_999;
}

/** Tidy a recipe before saving: trim text, drop empties, and keep only what the chosen ending uses. */
export function cleanSpec(spec: CustomGameSpec, now = Date.now()): CustomGameSpec {
  const text = (v: string, max: number) => v.trim().slice(0, max);
  const roundNames =
    spec.end === 'rounds' && spec.roundNames
      ? Array.from({ length: spec.rounds }, (_, i): RoundMeta => {
          const r = spec.roundNames?.[i];
          const label = text(r?.label ?? '', 24) || `Round ${i + 1}`;
          const note = text(r?.note ?? '', 40);
          return note ? { label, note } : { label };
        })
      : null;
  return {
    ...spec,
    name: text(spec.name, LIMITS.name),
    icon: spec.icon || '🎲',
    kind: text(spec.kind, 20) || 'Other',
    roundNames,
    finalTurns: spec.end === 'target' && spec.win === 'highest' && spec.finalTurns,
    entryLabel: text(spec.entryLabel, 24),
    shortcuts: [...new Set(spec.shortcuts)].slice(0, LIMITS.shortcuts),
    out: spec.out ? { ...spec.out, label: text(spec.out.label, LIMITS.label) } : null,
    quick: spec.quick ? { ...spec.quick, label: text(spec.quick.label, LIMITS.label) } : null,
    cheatSheet: text(spec.cheatSheet, LIMITS.cheatSheet),
    notes: spec.notes.map((n) => text(n, LIMITS.note)).filter(Boolean).slice(0, LIMITS.notes),
    updatedAt: now,
  };
}

/** Turn a recipe into a playable game. */
export function buildCustomGame(spec: CustomGameSpec): GameModule {
  const lowest = spec.win === 'lowest';
  let winner: WinnerRule;
  if (spec.end === 'target') {
    winner = lowest ? { rule: 'lowest-total', endAt: spec.target } : { rule: 'first-to-target', target: spec.target, finalTurns: spec.finalTurns };
  } else winner = lowest ? { rule: 'lowest-total' } : { rule: 'highest-total' };

  const rounds =
    spec.end === 'rounds'
      ? Array.from({ length: spec.rounds }, (_, i) => spec.roundNames?.[i] ?? { label: `Round ${i + 1}` })
      : undefined;

  const out = spec.out;
  const roundGrid: RoundGridRules = {
    entryLabel: spec.entryLabel,
    ...(out ? { out: { label: out.label, ...(out.score === null ? {} : { score: out.score }) } } : {}),
    ...(out && (out.bonus || out.othersGet || out.penalty) ? { adjust: outAdjust(spec) } : {}),
    ...(spec.allowNegative ? { allowNegative: true } : {}),
    ...(spec.bigNumbers ? { entryDigits: 7 } : {}),
    ...(spec.quick ? { quickScore: { ...spec.quick } } : {}),
    phone: {
      prompt: `Your ${spec.entryLabel.toLowerCase()}`,
      keypad: spec.shortcuts.map((v) => ({ label: v > 0 ? `+${v}` : String(v), value: v })),
      ...(out ? { specialLabel: out.label } : spec.quick ? { specialLabel: spec.quick.label } : {}),
    },
  };

  return {
    id: spec.id,
    name: spec.name || 'Untitled game',
    mode: 'rounds',
    surface: 'round-grid',
    players: { min: spec.players.min, max: spec.players.max },
    ...(rounds ? { rounds } : {}),
    roundGrid,
    turns: spec.rotateDealer ? { type: 'dealer-rotation' } : { type: 'none' },
    options: [],
    winner,
    ...(spec.cheatSheet ? { cheatSheet: { text: spec.cheatSheet } } : {}),
    ...(spec.end === 'host' ? { hostEnds: true } : {}),
    about: {
      kind: spec.kind,
      tagline: describeEnd(spec),
      time: '',
      rules: spec.notes.length > 0 ? spec.notes : describeRules(spec),
      ...(spec.notes.length > 0 ? { reference: { title: 'Scoring', rows: referenceRows(spec) } } : {}),
    },
    custom: spec,
  };
}

/**
 * The marked player's adjustments: their bonus always, then either everyone else gets
 * othersGet (they had the round's best score) or they get the penalty.
 */
function outAdjust(spec: CustomGameSpec) {
  const { bonus, othersGet, penalty } = spec.out!;
  const lowest = spec.win === 'lowest';
  return (entries: number[], marked: number | null): number[] => {
    if (marked === null) return entries;
    const mine = entries[marked];
    const best = entries.every((v, i) => i === marked || (lowest ? v > mine : v < mine));
    return entries.map((v, i) => {
      if (i === marked) return v + bonus + (best ? 0 : penalty);
      return best ? v + othersGet : v;
    });
  };
}

const fmt = (n: number) => n.toLocaleString('en-US');
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n).replace('-', '−'));

/** One line on how the game is won and when it ends. */
export function describeEnd(spec: CustomGameSpec): string {
  const win = spec.win === 'lowest' ? 'Lowest total wins' : 'Highest total wins';
  if (spec.end === 'rounds') return `${win} after ${spec.rounds} ${spec.rounds === 1 ? 'round' : 'rounds'}.`;
  if (spec.end === 'host') return `${win}. Play as long as you like; the host ends the game.`;
  if (spec.win === 'lowest') return `The game ends once someone reaches ${fmt(spec.target)}. ${win}.`;
  return `First to ${fmt(spec.target)}${spec.finalTurns ? ', then everyone else gets one last turn' : ''}. ${win}.`;
}

/** Plain-language rules made from the recipe, for games without house-rule notes. */
export function describeRules(spec: CustomGameSpec): string[] {
  const lines = [describeEnd(spec), `Each round, everyone enters their ${spec.entryLabel.toLowerCase()}.`];
  lines.push(...referenceRows(spec).map((r) => `${r.label}: ${r.value}.`));
  if (spec.rotateDealer) lines.push('The dealer moves one seat each round.');
  return lines;
}

function referenceRows(spec: CustomGameSpec): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const out = spec.out;
  if (out) {
    const parts = [out.score === null ? 'marks who it was' : `score becomes ${fmt(out.score)}`];
    if (out.bonus) parts.push(`${signed(out.bonus)} for them`);
    if (out.othersGet) parts.push(`${signed(out.othersGet)} for everyone else if theirs was the best score`);
    if (out.penalty) parts.push(`${signed(out.penalty)} for them if it wasn't`);
    rows.push({ label: out.label, value: parts.join(', ') });
  }
  if (spec.quick) rows.push({ label: spec.quick.label, value: `scores ${fmt(spec.quick.score)}` });
  if (spec.shortcuts.length) rows.push({ label: 'Shortcuts', value: spec.shortcuts.map(signed).join('  ') });
  return rows;
}
