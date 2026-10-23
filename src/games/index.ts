import type { GameModule } from '../lib/types';
import { farkle } from './farkle';
import { fiveCrowns } from './fiveCrowns';
import { skullKing } from './skullKing';

/** The game library. To add a game, create a module in this folder and list it here. */
export const games: GameModule[] = [fiveCrowns, farkle, skullKing];

export function getGame(id: string): GameModule | undefined {
  return games.find((g) => g.id === id);
}
