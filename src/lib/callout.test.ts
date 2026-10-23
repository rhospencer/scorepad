import { describe, expect, it } from 'vitest';
import { roundCallout } from './callout';
import { fiveCrowns } from '../games/fiveCrowns';
import { farkle } from '../games/farkle';
import type { Session } from './types';

function session(scores: number[][], names = ['Ana', 'Ben', 'Cat', 'Dev']): Session {
  const players = names.slice(0, scores[0]?.length ?? names.length).map((name, i) => ({ id: `p${i}`, name }));
  return { id: 'g1', gameId: 'x', players, scores, outs: [], createdAt: 0, updatedAt: 0 } as unknown as Session;
}

describe('roundCallout', () => {
  it('says nothing after the first round', () => {
    expect(roundCallout(farkle, session([[500, 0, 0]]))).toBeNull();
  });

  it('calls a new leader (highest wins)', () => {
    const c = roundCallout(farkle, session([[500, 300, 0], [0, 400, 0]]));
    expect(c).toMatchObject({ kind: 'lead', seat: 1, text: 'Ben takes the lead!', id: 'g1:2' });
  });

  it('calls a new leader (lowest wins)', () => {
    const c = roundCallout(fiveCrowns, session([[0, 10, 20], [30, 0, 0]]));
    expect(c).toMatchObject({ kind: 'lead', seat: 1 });
  });

  it('calls a tie for the lead', () => {
    const c = roundCallout(farkle, session([[500, 300, 0], [0, 200, 0]]));
    expect(c).toMatchObject({ kind: 'tie', text: 'Ana and Ben are tied for the lead' });
  });

  it('calls a climb of two places', () => {
    const c = roundCallout(farkle, session([[900, 600, 300, 0], [0, 0, 0, 700]]));
    expect(c).toMatchObject({ kind: 'climb', seat: 3, text: 'Dev climbs from 4th to 2nd' });
  });

  it('stays quiet when the order holds', () => {
    expect(roundCallout(farkle, session([[500, 300, 0], [100, 100, 100]]))).toBeNull();
  });
});
