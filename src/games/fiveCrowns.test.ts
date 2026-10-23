import { describe, expect, it } from 'vitest';
import { fiveCrowns } from './fiveCrowns';
import { dealerFor, isFinished, totals, winners } from '../lib/scoring';

describe('Five Crowns module', () => {
  it('has 11 rounds from 3 to 13 cards with matching wilds', () => {
    expect(fiveCrowns.rounds).toHaveLength(11);
    expect(fiveCrowns.rounds![0]).toEqual({ label: '3 cards', note: '3s are wild' });
    expect(fiveCrowns.rounds![10]).toEqual({ label: '13 cards', note: 'Kings are wild' });
  });

  it('suggests 2 to 7 players, with a tip for bigger tables', () => {
    expect(fiveCrowns.players).toMatchObject({ min: 2, max: 7 });
    expect(fiveCrowns.players.beyond?.tip).toMatch(/second deck/);
  });
});

describe('scoring helpers', () => {
  const scores = [
    [12, 0, 23, 8],
    [0, 18, 31, 14],
    [25, 9, 0, 17],
  ];

  it('sums totals per player', () => {
    expect(totals(scores, 4)).toEqual([37, 27, 54, 39]);
  });

  it('picks the lowest total as the winner', () => {
    expect(winners(fiveCrowns.winner, [37, 27, 54, 39])).toEqual([1]);
  });

  it('reports ties', () => {
    expect(winners({ rule: 'lowest-total' }, [10, 10, 30])).toEqual([0, 1]);
  });

  it('rotates the dealer', () => {
    expect(dealerFor(0, 4)).toBe(0);
    expect(dealerFor(3, 4)).toBe(3);
    expect(dealerFor(4, 4)).toBe(0);
  });

  it('finishes after the last round', () => {
    expect(isFinished(fiveCrowns, scores)).toBe(false);
    expect(isFinished(fiveCrowns, new Array(11).fill([0, 0, 0, 0]))).toBe(true);
  });
});
