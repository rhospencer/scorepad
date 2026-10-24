/** How a game is played, used for the library filter chips. */
export type Mode = 'rounds' | 'turn-based' | 'free-form';

/** Reusable scoring screens. A game module picks one. */
export type SurfaceId = 'round-grid' | 'bid-tricks' | 'category-sheet' | 'running-tally';

export type TurnModel =
  | { type: 'none' }
  /** `option` names a boolean option that switches the rotation on or off. */
  | { type: 'dealer-rotation'; option?: string }
  | { type: 'strict-order' };

export type WinnerRule =
  /** Lowest total wins. With `endAt`, the game ends after a round leaves anyone at or over it. */
  | { rule: 'lowest-total'; endAt?: number }
  | { rule: 'highest-total' }
  /**
   * Play until someone reaches `target`; highest total wins. With `finalTurns`, once
   * someone gets there everyone else takes one last turn (Farkle). Without it, the
   * game simply ends after that round (Cover Your Assets).
   */
  | { rule: 'first-to-target'; target: number; finalTurns?: boolean };

export interface RoundMeta {
  /** Short label shown in the round header, e.g. "6 cards". */
  label: string;
  /** Extra rule for this round, e.g. "6s are wild". */
  note?: string;
}

/** A setup option's value: an on/off switch, or the id of a choice. */
export type OptionValue = boolean | string;
export type Options = Record<string, OptionValue>;

export type OptionDef =
  | { id: string; label: string; type: 'boolean'; default: boolean }
  /** Pick one of several, e.g. how the game ends. */
  | { id: string; label: string; type: 'choice'; default: string; choices: { value: string; label: string }[] };

/** Game-specific rules for the 'round-grid' scoring surface. */
export interface RoundGridRules {
  /** What each player enters per round, e.g. "Hand total". */
  entryLabel: string;
  /** A per-round "went out" button. At most one player per round; it sets their score. */
  /**
   * One player per round can be marked (Five Crowns "Out", Kombio's caller). With
   * `score`, marking them also sets their score; without, it only marks who it was.
   */
  out?: { label: string; score?: number };
  /** Adjust a finished round's scores, e.g. Kombio's caller penalty. `out` is the marked player. */
  adjust?: (entries: number[], out: number | null) => number[];
  /** Scores can go below zero (special hands). */
  allowNegative?: boolean;
  /** Most digits a score can have (default 5). Money games use more. */
  entryDigits?: number;
  /** A per-player button that fills in a fixed score. Any number of players can use it in a round (Farkle: 0). */
  quickScore?: { label: string; score: number };
  /** How phones enter a score: the question, tap-to-add buttons, and the label for the out/quick button. */
  phone?: {
    prompt: string;
    keypad: { label: string; value: number }[];
    specialLabel?: string;
  };
}

/** One player's line in a trick-taking round: their bid, the tricks they won, and bonus captures. */
export interface TrickEntry {
  bid: number | null;
  tricks: number | null;
  /** Bonus id → how many (e.g. { pirateBySkullKing: 1 }). */
  captures: Record<string, number>;
}

/** Rules for the 'bid-tricks' surface (Skull King and friends). */
export interface BidTricksRules {
  /** Cards dealt (and the most tricks anyone can win) in a 0-based round. */
  cards: (round: number) => number;
  /** Bonus captures, in the order the screen shows them. */
  bonuses: { id: string; label: string; points: number }[];
  /** Points for one player's round. Can be negative. */
  score: (entry: TrickEntry, cards: number, bonusPoints: number) => number;
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
  /** An emoji shown beside the name in the library. */
  icon: string;
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
  bidTricks?: BidTricksRules;
  turns: TurnModel;
  options: OptionDef[];
  winner: WinnerRule;
  /** Rounds and winning rule that depend on setup options (e.g. "after 5 rounds"). */
  configure?: (options: Options) => Partial<Pick<GameModule, 'rounds' | 'winner'>>;
  /** Short reference text. `option` names a boolean option that shows or hides it. */
  cheatSheet?: { text: string; option?: string };
  about?: GameAbout;
  /** No set end: the host taps End game when they're done. */
  hostEnds?: boolean;
  /** Set for games built in the app's game builder: the recipe it was made from. */
  custom?: CustomGameSpec;
}

/**
 * A game someone built in the app. Saved on the device, and copied into every game
 * started from it, so editing or deleting it later never changes past games.
 */
export interface CustomGameSpec {
  /** Starts with "custom-". */
  id: string;
  name: string;
  /** An emoji shown in the library. */
  icon: string;
  kind: string;
  players: { min: number; max: number };
  win: 'highest' | 'lowest';
  /** rounds = a set number of rounds; target = until someone reaches a score; host = the host ends it. */
  end: 'rounds' | 'target' | 'host';
  rounds: number;
  /** Optional name and note for each round ("3 cards", "Wilds: 3s"). Null = numbered rounds. */
  roundNames: RoundMeta[] | null;
  target: number;
  /** Target, highest wins: once someone gets there, everyone else takes one last turn. */
  finalTurns: boolean;
  entryLabel: string;
  allowNegative: boolean;
  bigNumbers: boolean;
  /** Tap-to-add buttons, on the phone keypad. */
  shortcuts: number[];
  /**
   * One player a round can be marked ("Went out"). score: what their score becomes (null = only marks them).
   * bonus is added to them; if they had the best score that round everyone else gets othersGet,
   * otherwise they get penalty. All may be negative.
   */
  out: { label: string; score: number | null; bonus: number; othersGet: number; penalty: number } | null;
  /** A per-player button that fills in a fixed score ("Bust" = 0). */
  quick: { label: string; score: number } | null;
  rotateDealer: boolean;
  cheatSheet: string;
  /** House rules, shown with the game. */
  notes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Player {
  id: string;
  name: string;
  /** Picked on the player's phone or in setup. Without one, the avatar shows their initial. */
  emoji?: string;
  /** Set when they joined from their phone, so their phone can find them on the live scoreboard. */
  lobbyId?: string;
  /** Who this is across games (a saved player or a phone's own id). Records follow it, not the name. */
  personId?: string;
  /**
   * Joined mid-game: the first round they played (0-based). Earlier rounds score 0,
   * except the round just before, which holds their starting score.
   */
  joinedRound?: number;
}

/**
 * Someone this device has played with. Phones bring their own id; players typed in on
 * the host get one the first time. Saved on the host, offered as quick picks in setup.
 */
export interface Person {
  id: string;
  name: string;
  emoji?: string;
  lastPlayed: number;
  /** Set when merged into another person ("the same Maya"): their records count as that person's. */
  mergedInto?: string;
}

/** A player as entered in setup: a plain name, or a name with an emoji avatar (and phone link). */
export type PlayerInput = string | { name: string; emoji?: string; lobbyId?: string; personId?: string };

/** A game in progress or finished. Stored on the device. */
export interface Session {
  id: string;
  gameId: string;
  players: Player[];
  /** Round-major: scores[round][playerIndex]. */
  scores: number[][];
  /** Round-major: which player went out each round (null if nobody was marked). */
  outs: (number | null)[];
  options: Options;
  /** The round being entered but not finished yet, so a refresh keeps it. */
  draft?: RoundDraft;
  startedAt: number;
  finishedAt?: number;
  /** The phone lobby this game publishes its live scoreboard to. */
  lobby?: { code: string; hostKey: string };
  /** 'bid-tricks' games: each scored round's bids, tricks and captures (round-major). */
  tricks?: TrickEntry[][];
  /** Games built in the app: the rules as they were when this game started. */
  custom?: CustomGameSpec;
}

export interface RoundDraft {
  entries: (number | null)[];
  out: number | null;
  /** Players whose phone score the host sent back this round. */
  sentBack?: number[];
  /** 'bid-tricks' games: bids are entered first, then tricks and bonuses. */
  phase?: 'bid' | 'play';
  tricks?: TrickEntry[];
}
