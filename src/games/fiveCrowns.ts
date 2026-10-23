import type { GameModule, RoundMeta } from '../lib/types';

const WILDS = ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'Jacks', 'Queens', 'Kings'];

/** 11 rounds: round 1 deals 3 cards, round 11 deals 13. The wild rank matches the card count. */
const rounds: RoundMeta[] = WILDS.map((wild, i) => ({
  label: `${i + 3} cards`,
  note: `${wild} are wild`,
}));

export const fiveCrowns: GameModule = {
  id: 'five-crowns',
  name: 'Five Crowns',
  mode: 'rounds',
  surface: 'round-grid',
  // One deck suits 2–7. Bigger tables shuffle in a second deck.
  players: { min: 2, max: 7, beyond: { tip: 'More than 7 players? Shuffle in a second deck.' } },
  rounds,
  roundGrid: {
    entryLabel: 'Hand total',
    // Whoever goes out scores nothing that round.
    out: { label: 'Out', score: 0 },
    phone: {
      prompt: 'Cards left in your hand',
      // Tap each card left in your hand; the phone adds them up.
      keypad: [
        ...['3', '4', '5', '6', '7', '8', '9', '10'].map((c) => ({ label: c, value: Number(c) })),
        { label: 'J', value: 11 },
        { label: 'Q', value: 12 },
        { label: 'K', value: 13 },
        { label: 'Wild', value: 20 },
        { label: 'Joker', value: 50 },
      ],
      specialLabel: 'I went out',
    },
  },
  turns: { type: 'dealer-rotation', option: 'rotateDealer' },
  options: [
    { id: 'rotateDealer', label: 'Rotate dealer each round', type: 'boolean', default: true },
    { id: 'cheatSheet', label: 'Show card values cheat sheet', type: 'boolean', default: true },
  ],
  winner: { rule: 'lowest-total' },
  cheatSheet: {
    text: '3–10 face value · J 11 · Q 12 · K 13 · wild 20 · Joker 50',
    option: 'cheatSheet',
  },
  about: {
    kind: 'Card game',
    tagline: 'A rummy-style card game where the wild card changes every round. Fewest points left in your hand wins.',
    time: '45–60 min',
    rules: [
      'Round 1 deals 3 cards, round 11 deals 13. The wild rank matches the number of cards dealt; jokers are always wild.',
      'On your turn, draw from the deck or the discard pile, then discard one card.',
      'Build books (3+ of the same rank) and runs (3+ in a row, same suit).',
      'Go out when every card is in a book or run. Everyone else gets one last turn.',
      'Cards left in your hand count against you. After 11 rounds, the lowest total wins.',
    ],
    reference: {
      title: 'Card values',
      rows: [
        { label: '3 to 10', value: 'Face value' },
        { label: 'Jack', value: '11' },
        { label: 'Queen', value: '12' },
        { label: 'King', value: '13' },
        { label: 'Wild card', value: '20' },
        { label: 'Joker', value: '50' },
      ],
      note: 'Phones use these values to add up a hand.',
    },
  },
};
