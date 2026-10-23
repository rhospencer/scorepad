import { buildCustomGame } from '../lib/customGame';
import { configuredGame } from '../lib/session';
import type { GameModule, Session } from '../lib/types';
import { coverYourAssets } from './coverYourAssets';
import { farkle } from './farkle';
import { fiveCrowns } from './fiveCrowns';
import { kombio } from './kombio';
import { skullKing } from './skullKing';

/** The game library. To add a game, create a module in this folder and list it here. */
export const games: GameModule[] = [fiveCrowns, farkle, skullKing, coverYourAssets, kombio];

export function getGame(id: string): GameModule | undefined {
  return games.find((g) => g.id === id);
}

/** A session's game with its setup options applied (e.g. Kombio "after 5 rounds"). */
export function getSessionGame(session: Session): GameModule | undefined {
  // Games built in the app carry their own rules.
  const game = session.custom ? buildCustomGame(session.custom) : getGame(session.gameId);
  return game && configuredGame(game, session.options);
}
