import type { GameModule } from '../lib/types';

/**
 * Each round, every player takes one turn and enters what they banked.
 * A bust (no scoring dice) is a Farkle: 0 for the turn.
 * The game ends when a round finishes with someone at 10,000 or more; highest total wins.
 */
export const farkle: GameModule = {
  id: 'farkle',
  name: 'Farkle',
  mode: 'turn-based',
  surface: 'round-grid',
  players: { min: 2, max: 8, beyond: { tip: 'Any number can play. Bigger tables just mean longer rounds.' } },
  roundGrid: {
    entryLabel: 'Turn score',
    quickScore: { label: 'Farkle', score: 0 },
    phone: {
      prompt: 'Points banked this turn',
      keypad: [50, 100, 500, 1000].map((v) => ({ label: `+${v.toLocaleString('en-US')}`, value: v })),
      specialLabel: 'I farkled',
    },
  },
  turns: { type: 'strict-order' },
  options: [{ id: 'cheatSheet', label: 'Show scoring cheat sheet', type: 'boolean', default: true }],
  winner: { rule: 'first-to-target', target: 10000, finalTurns: true },
  cheatSheet: {
    text: '1 = 100 · 5 = 50 · three 1s = 1,000 · three of a kind = 100 × face · 1–6 straight = 1,500 · three pairs = 1,500',
    option: 'cheatSheet',
  },
  about: {
    kind: 'Dice game',
    tagline: 'Push your luck with six dice. Keep rolling for more points, but roll nothing that scores and you lose the lot.',
    time: '20–40 min',
    rules: [
      'Roll all six dice. Set aside at least one scoring die.',
      'Bank your points, or reroll the rest to try for more.',
      'Roll no scoring dice and it’s a Farkle: you lose everything from that turn.',
      'Score with all six dice and you have hot dice: roll all six again.',
      'Once someone reaches 10,000, everyone else gets one last turn. Highest total wins.',
    ],
    reference: {
      title: 'Scoring',
      rows: [
        { label: 'Single 1', value: '100' },
        { label: 'Single 5', value: '50' },
        { label: 'Three 1s', value: '1,000' },
        { label: 'Three of a kind', value: '100 × face' },
        { label: 'Straight 1–6', value: '1,500' },
        { label: 'Three pairs', value: '1,500' },
      ],
      note: 'House rules vary; these are the common ones.',
    },
  },
};
