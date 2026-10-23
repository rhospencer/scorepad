import type { GameModule, RoundMeta } from '../lib/types';

const roundsOf = (n: number): RoundMeta[] => Array.from({ length: n }, (_, i) => ({ label: `Round ${i + 1}` }));

/**
 * Lowest total wins. Each round everyone enters their hand total; the host marks who
 * called KOMBIO and the caller rule is applied when the round is saved.
 * The host picks the game length at setup: first to 100, or a fixed 5 or 10 rounds.
 */
export const kombio: GameModule = {
  id: 'kombio',
  name: 'Kombio',
  icon: '🃏',
  mode: 'rounds',
  surface: 'round-grid',
  players: { min: 2, max: 6 },
  roundGrid: {
    entryLabel: 'Hand total',
    out: { label: 'KOMBIO' },
    // Special hands score below zero: two 14s = −15, one 14 + 25 = −10.
    allowNegative: true,
    adjust(entries, caller) {
      if (caller === null) return entries;
      const mine = entries[caller];
      // The caller must be strictly lowest. If so, everyone else takes +10; if anyone ties or beats them, the caller takes +15.
      const lowest = entries.every((v, i) => i === caller || v > mine);
      return entries.map((v, i) => (lowest ? (i === caller ? v : v + 10) : i === caller ? v + 15 : v));
    },
    phone: { prompt: 'Your hand total', keypad: [], specialLabel: 'I called KOMBIO' },
  },
  turns: { type: 'dealer-rotation', option: 'rotateDealer' },
  options: [
    {
      id: 'length',
      label: 'Game ends',
      type: 'choice',
      default: 'to100',
      choices: [
        { value: 'to100', label: 'When someone hits 100' },
        { value: '5', label: 'After 5 rounds' },
        { value: '10', label: 'After 10 rounds' },
      ],
    },
    { id: 'rotateDealer', label: 'Rotate dealer each round', type: 'boolean', default: true },
  ],
  winner: { rule: 'lowest-total', endAt: 100 },
  configure(options) {
    const n = Number(options.length);
    if (n === 5 || n === 10) return { rounds: roundsOf(n), winner: { rule: 'lowest-total' } };
    return { rounds: undefined, winner: { rule: 'lowest-total', endAt: 100 } };
  },
  cheatSheet: {
    text: 'KOMBIO caller lowest: everyone else +10 · tied or beaten: caller +15 · two 14s = −15 · one 14 + 25 = −10',
  },
  about: {
    kind: 'Card game',
    tagline: 'A memory card game: keep track of your face-down cards, swap smart, and call KOMBIO when you think your hand is lowest.',
    time: '20–40 min',
    rules: [
      'Everyone has a grid of face-down cards and peeks at a few to start.',
      'On your turn, draw and either swap it into your grid or discard it to use its ability (7–14).',
      'Match a card to the discard pile to get rid of it; a wrong match costs you a penalty card.',
      'Call KOMBIO when you think you’re lowest. Everyone else gets one more turn, then hands are revealed.',
      'Lowest total wins the game. The host picks how long it runs at setup.',
    ],
    reference: {
      title: 'Round scoring',
      rows: [
        { label: 'Your score', value: 'Cards in hand' },
        { label: 'KOMBIO caller is lowest', value: 'Others +10' },
        { label: 'Caller tied or beaten', value: 'Caller +15' },
        { label: 'Two 14s, nothing else', value: '−15' },
        { label: 'One 14 + cards totaling 25', value: '−10' },
      ],
    },
  },
};
