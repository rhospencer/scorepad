import type { GameModule, RoundMeta } from '../lib/types';

/** 10 rounds; round 1 deals 1 card, round 10 deals 10. */
const rounds: RoundMeta[] = Array.from({ length: 10 }, (_, i) => ({
  label: i === 0 ? '1 card' : `${i + 1} cards`,
}));

export const skullKing: GameModule = {
  id: 'skull-king',
  name: 'Skull King',
  icon: '🏴‍☠️',
  mode: 'rounds',
  surface: 'bid-tricks',
  players: { min: 2, max: 8, beyond: { tip: 'Big tables run out of cards in the late rounds; agree on a house rule.' } },
  rounds,
  bidTricks: {
    cards: (round) => round + 1,
    bonuses: [
      { id: 'fourteen', label: 'Standard 14', points: 10 },
      { id: 'blackFourteen', label: 'Black 14 (Jolly Roger)', points: 20 },
      { id: 'mermaidByPirate', label: 'Mermaid taken by a pirate', points: 20 },
      { id: 'pirateBySkullKing', label: 'Pirate taken by the Skull King', points: 30 },
      { id: 'skullKingByMermaid', label: 'Skull King taken by a mermaid', points: 40 },
    ],
    score(entry, cards, bonusPoints) {
      const { bid, tricks } = entry;
      if (bid === null || tricks === null) return 0;
      // Bid zero: 10 per card dealt if you take no tricks, lose that much if you take any.
      if (bid === 0) return tricks === 0 ? 10 * cards : -10 * cards;
      // Made it: 20 per trick bid, plus bonuses. Missed: lose 10 per trick off, no bonuses.
      if (tricks === bid) return 20 * bid + bonusPoints;
      return -10 * Math.abs(bid - tricks);
    },
  },
  turns: { type: 'dealer-rotation', option: 'rotateDealer' },
  options: [{ id: 'rotateDealer', label: 'Rotate dealer each round', type: 'boolean', default: true }],
  winner: { rule: 'highest-total' },
  about: {
    kind: 'Card game',
    tagline: 'A pirate trick-taking game. Bid exactly how many tricks you’ll win each round; nail it for big points, miss and you pay.',
    time: '30–45 min',
    rules: [
      'Round 1 deals 1 card, round 10 deals 10.',
      'Everyone bids at once how many tricks they’ll win (fist-bump and reveal).',
      'Play the tricks. Pirates beat suits, the Skull King beats pirates, and mermaids beat the Skull King.',
      'Make your bid: 20 points per trick. Miss: lose 10 per trick you were off.',
      'Bid zero and take none: 10 points per card dealt. Take any and lose that much. Highest total after 10 rounds wins.',
    ],
    reference: {
      title: 'Bonuses (only if you make your bid)',
      rows: [
        { label: 'Each standard 14', value: '+10' },
        { label: 'Black 14 (Jolly Roger)', value: '+20' },
        { label: 'Mermaid taken by a pirate', value: '+20' },
        { label: 'Pirate taken by the Skull King', value: '+30' },
        { label: 'Skull King taken by a mermaid', value: '+40' },
      ],
    },
  },
};
