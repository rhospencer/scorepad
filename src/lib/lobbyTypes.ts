/** Shapes shared by the lobby server (server/) and the app. */

export interface LobbyPlayer {
  id: string;
  name: string;
  emoji: string;
}

export interface LobbyView {
  /** 4 letters, e.g. "QKZD". */
  code: string;
  gameName: string;
  /** How many more phone players can join (the host's typed-in players use the rest). */
  openSlots: number;
  status: 'open' | 'started' | 'closed';
  players: LobbyPlayer[];
  /** Live standings the host publishes once the game is under way. */
  scoreboard: Scoreboard | null;
  /** The round phones can send scores for, published by the host. Null between games. */
  round: LiveRound | null;
  /** Lobby ids of players who sent a score for the current round (values stay hidden from phones). */
  submitted: string[];
  /** Host only: the scores phones sent for the current round, by lobby id. */
  submissions?: Record<string, Submission>;
}

/** A score a phone sent. `special` means they tapped the game's button (Five Crowns "Out", Farkle "Farkle"). */
export interface Submission {
  gameId: string;
  round: number;
  value: number;
  special: boolean;
  /** Bid-and-tricks games: which half of the round this is for, and what was sent. */
  phase?: 'bid' | 'play';
  bid?: number;
  tricks?: number;
  captures?: Record<string, number>;
}

export type LiveRoundState = 'open' | 'approved' | 'sentBack' | 'sittingOut';

export interface LiveRoundPlayer {
  /** Null for players the host types in. */
  lobbyId: string | null;
  name: string;
  emoji?: string;
  seat: number;
  /** approved = the host has a score for them this round; sentBack = the host returned their score. */
  state: LiveRoundState;
}

/** What a phone needs to enter a score for the round in progress. Built in src/lib/liveRound.ts. */
export interface LiveRound {
  /** The host's game id; changes on rematch. */
  gameId: string;
  /** 0-based round being scored. */
  round: number;
  /** "Round 4", "6 cards", "Final turns". */
  title: string;
  /** "6s are wild", "First to 10,000". */
  note: string | null;
  dealer: string | null;
  /** The question on the phone, e.g. "Cards left in your hand". */
  prompt: string;
  /** Most digits a score can have (money games allow 7). */
  maxDigits?: number;
  /** Tap-to-add buttons: card values or point shortcuts. */
  keypad: { label: string; value: number }[];
  /** The game's one-tap score ("I went out", "I farkled"). exclusive = only one player per round. */
  /** score null: the button only marks the player (Kombio's caller); they still send a total. */
  special: { label: string; score: number | null; exclusive: boolean; takenBy: string | null } | null;
  /** Scores can be negative (special hands). */
  allowNegative?: boolean;
  players: LiveRoundPlayer[];
  /** Bid-and-tricks games (Skull King). Absent for other games. */
  trick?: LiveTrickRound | null;
}

/** A bid-and-tricks round as phones see it. */
export interface LiveTrickRound {
  /** Bids are sent first; after the host locks them, tricks and bonuses. */
  phase: 'bid' | 'play';
  /** Cards dealt: the highest bid or trick count. */
  cards: number;
  bonuses: { id: string; label: string; points: number }[];
  /** Everyone's bid by seat, shown once bids are locked (null while bidding). */
  bids: (number | null)[] | null;
}

/** One player's line on the phones' live scoreboard. */
export interface ScoreboardRow {
  /** The lobby player this is, or null for a player the host typed in. */
  lobbyId: string | null;
  name: string;
  emoji?: string;
  /** 0-based seat, for the avatar color. */
  seat: number;
  total: number;
  /** 1-based; ties share a rank. */
  rank: number;
  /** Points behind the leader. */
  behind: number;
  /** Score in the latest round, or null before the first round (or when they sat it out). */
  last: number | null;
}

/** What phones see after the host starts: built from the host's game in src/lib/scoreboard.ts. */
export interface Scoreboard {
  /** Changes on rematch, so phones can tell a fresh game from the old one. */
  gameId: string;
  gameName: string;
  /** e.g. "After round 3 of 11", "Final turns". */
  status: string;
  /** e.g. "Lowest score wins". */
  rule: string;
  finished: boolean;
  /** Names of the winner(s) once finished. */
  winners: string[];
  /** Best first. */
  rows: ScoreboardRow[];
}

/** What the host needs to build a join link phones can reach. */
export interface LobbyNetwork {
  /** This computer's addresses on the local network, e.g. ["192.168.1.20"]. */
  addresses: string[];
  port: number;
}
