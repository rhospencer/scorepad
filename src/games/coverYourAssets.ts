import type { GameModule } from '../lib/types';

/**
 * Classic game: play rounds until someone's running total passes $1,000,000.
 * Each round, every player enters the value of their asset stack.
 */
export const coverYourAssets: GameModule = {
  id: 'cover-your-assets',
  name: 'Cover Your Assets',
  icon: '💰',
  mode: 'rounds',
  surface: 'round-grid',
  players: { min: 2, max: 6 },
  roundGrid: {
    entryLabel: 'Stack value ($)',
    entryDigits: 7,
    phone: {
      prompt: 'Your stack value ($)',
      // Shortcuts for adding up a stack; typing the total works too.
      keypad: [5_000, 10_000, 25_000, 50_000].map((v) => ({ label: `+${v / 1000}k`, value: v })),
    },
  },
  turns: { type: 'dealer-rotation', option: 'rotateDealer' },
  options: [{ id: 'rotateDealer', label: 'Rotate dealer each round', type: 'boolean', default: true }],
  winner: { rule: 'first-to-target', target: 1_000_000 },
  about: {
    kind: 'Card game',
    tagline: 'Build towers of matching assets and steal your friends’ treasures. First to a million wins.',
    time: '20–40 min',
    rules: [
      'Deal 4 cards each (5 with two players). Flip one card face up to start the discard pile.',
      'On your turn: pair two matching cards from your hand, pair one with the top discard, steal, or discard and draw.',
      'Steal by playing a card matching the top of someone’s stack. They can defend with a match; the last one standing takes the whole set.',
      'Gold and Silver are wild. Only the top set on a stack can be stolen.',
      'When the deck runs out and hands are played, everyone adds up their stack. Play rounds until someone passes $1,000,000.',
    ],
    reference: {
      title: 'Ways to play',
      rows: [
        { label: 'Classic', value: 'First past $1M' },
        { label: 'Quick game', value: 'High score, 1 round' },
        { label: 'Three rounds', value: 'High score after 3' },
        { label: 'Best of three', value: 'First to win 2' },
      ],
      note: 'Scorepad keeps score for the classic game.',
    },
  },
};
