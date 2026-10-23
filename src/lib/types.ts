/** How a game is played, used for the library filter chips. */
export type Mode = 'rounds' | 'turn-based' | 'free-form';

/** Reusable scoring screens. A game module picks one. */
export type SurfaceId = 'round-grid' | 'category-sheet' | 'running-tally';

export type TurnModel =
  | { type: 'none' }
  /** `option` names a boolean option that switches the rotation on or off. */
  | { type: 'dealer-rotation'; option?: string }
  | { type: 'strict-order' };

export type WinnerRule =
  | { rule: 'lowest-total' }
  | { rule: 'highest-total' }
  | { rule: 'first-to-target'; target: number };

export interface RoundMeta {
  /** Short label shown in the round header, e.g. "6 cards". */
  label: string;
  /** Extra rule for this round, e.g. "6s are wild". */
  note?: string;
}

export interface OptionDef {
  id: string;
  label: string;
  type: 'boolean';
  default: boolean;
}

/** Game-specific rules for the 'round-grid' scoring surface. */
export interface RoundGridRules {
  /** What each player enters per round, e.g. "Hand total". */
  entryLabel: string;
  /** A per-round "went out" button. At most one player per round; it sets their score. */
  out?: { label: string; score: number };
  /** A per-player button that fills in a fixed score. Any number of players can use it in a round (Farkle: 0). */
  quickScore?: { label: string; score: number };
  /** How phones enter a score: the question, tap-to-add buttons, and the label for the out/quick button. */
  phone?: {
    prompt: string;
    keypad: { label: string; value: number }[];
    specialLabel?: string;
  };
}

/** What the library shows about a game before you start one. */
export interface GameAbout {
  /** e.g. "Card game". */
  kind: string;
  /** One or two sentences on what the game is. */
  tagline: string;
  /** Typical length, e.g. "45–60 min". */
  time: string;
  /** Basic rules, in play order. Short enough to read at the table. */
  rules: string[];
  /** A scoring reference (card values, dice combos). */
  reference?: { title: string; rows: { label: string; value: string }[]; note?: string };
}

/** Everything the app needs to know about a game. Adding a game = adding one of these. */
export interface GameModule {
  id: string;
  name: string;
  mode: Mode;
  surface: SurfaceId;
  /**
   * min is required to start. max is only a suggestion: tables can go bigger (up to
   * MAX_PLAYERS). Past it, setup shows `beyond.tip`.
   */
  players: { min: number; max: number; beyond?: { tip: string } };
  /** Fixed round list for 'round-grid' games. */
  rounds?: RoundMeta[];
  roundGrid?: RoundGridRules;
  turns: TurnModel;
  options: OptionDef[];
  winner: WinnerRule;
  /** Short reference text. `option` names a boolean option that shows or hides it. */
  cheatSheet?: { text: string; option?: string };
  about?: GameAbout;
}

export interface Player {
  id: string;
  name: string;
  /** Picked on the player's phone or in setup. Without one, the avatar shows their initial. */
  emoji?: string;
  /** Set when they joined from their phone, so their phone can find them on the live scoreboard. */
  lobbyId?: string;
}

/** A player as entered in setup: a plain name, or a name with an emoji avatar (and phone link). */
export type PlayerInput = string | { name: string; emoji?: string; lobbyId?: string };

/** A game in progress or finished. Stored on the device. */
export interface Session {
  id: string;
  gameId: string;
  players: Player[];
  /** Round-major: scores[round][playerIndex]. */
  scores: number[][];
  /** Round-major: which player went out each round (null if nobody was marked). */
  outs: (number | null)[];
  options: Record<string, boolean>;
  /** The round being entered but not finished yet, so a refresh keeps it. */
  draft?: RoundDraft;
  startedAt: number;
  finishedAt?: number;
  /** The phone lobby this game publishes its live scoreboard to. */
  lobby?: { code: string; hostKey: string };
}

export interface RoundDraft {
  entries: (number | null)[];
  out: number | null;
  /** Players whose phone score the host sent back this round. */
  sentBack?: number[];
}
