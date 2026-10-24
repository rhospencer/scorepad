import type { GameModule, RoundMeta } from '../lib/types';

/** One round per double, counting down from the set's highest double to double-blank. */
export function engineRounds(highest: number): RoundMeta[] {
  return Array.from({ length: highest + 1 }, (_, i) => {
    const n = highest - i;
    return { label: n === 0 ? 'Double blank' : `Double ${n}`, note: `${n}|${n} engine` };
  });
}

/**
 * Lowest total wins. Each round everyone adds up the pips left in their hand; whoever
 * dominoes (plays their last tile) scores 0. A double-12 set plays 13 rounds, a
 * double-9 set plays 10.
 */
export const mexicanTrain: GameModule = {
  id: 'mexican-train',
  name: 'Mexican Train',
  icon: '🚂',
  mode: 'rounds',
  surface: 'round-grid',
  players: { min: 2, max: 8, beyond: { tip: 'More than 8 players? Deal fewer tiles each, or play with a double-15 set.' } },
  rounds: engineRounds(12),
  roundGrid: {
    entryLabel: 'Pips left',
    // Going out ("domino!") scores nothing that round.
    out: { label: 'Domino', score: 0 },
    phone: {
      prompt: 'Pips left in your hand',
      // Tap each half of every tile left; the phone adds them up.
      keypad: [
        ...Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
        { label: '0|0', value: 50 },
      ],
      specialLabel: 'I went out',
    },
  },
  turns: { type: 'none' },
  options: [
    {
      id: 'length',
      label: 'Domino set',
      type: 'choice',
      default: '12',
      choices: [
        { value: '12', label: 'Double-12 · 13 rounds' },
        { value: '9', label: 'Double-9 · 10 rounds' },
      ],
    },
    { id: 'cheatSheet', label: 'Show scoring cheat sheet', type: 'boolean', default: true },
  ],
  winner: { rule: 'lowest-total' },
  configure(options) {
    return { rounds: engineRounds(options.length === '9' ? 9 : 12) };
  },
  cheatSheet: {
    text: 'Count every pip left in your hand · double-blank 0|0 = 50 · going out = 0',
    option: 'cheatSheet',
  },
  about: {
    kind: 'Domino game',
    tagline: 'Build your own train of dominoes from the center engine, or add to the shared Mexican Train. Fewest pips left wins.',
    time: '60–90 min',
    rules: [
      'Each round starts from a new double in the center: double-12 first, then down one each round to double-blank.',
      'Draw tiles: 15 each for 2–4 players, 12 for 5–6, 11 for 7–8.',
      'On your turn, add one tile to your own train, the Mexican Train, or any train with a marker on it.',
      'Can’t play? Draw one. Still can’t? Put a marker on your train so anyone can play on it.',
      'Play a double and you must cover it before anyone plays elsewhere.',
      'The round ends when someone plays their last tile, or nobody can play. Everyone counts the pips left in their hand.',
    ],
    reference: {
      title: 'Scoring',
      rows: [
        { label: 'Each tile left', value: 'Its pips' },
        { label: 'Double-blank 0|0', value: '50' },
        { label: 'Going out', value: '0' },
        { label: 'Winner', value: 'Lowest total' },
      ],
      note: 'Tied at the end? Most rounds at 0 wins, then the lowest single round.',
    },
  },
};
