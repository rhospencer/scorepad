# Scorepad

A local, offline-first score keeper for tabletop and board games. Installable as a PWA. Everything is saved on the device (IndexedDB).

Design reference: the "Score Keeper App Design" canvas (library, setup, scoring, results, and the game module contract).

## Stack

Vite, Svelte 5, TypeScript, Dexie (IndexedDB), vite-plugin-pwa, Vitest.

## Run it

Needs Node 18 or newer (`.nvmrc` pins 22, so `nvm use` picks it up).

```sh
npm install
npm run dev      # local dev server
npm run test     # scoring and game module tests
npm run check    # type check
npm run build    # production build in dist/
```

## Players join from their phones

On the player setup screen, tap **Invite players by phone**. The host's screen shows a QR code, a link and a 4-letter code. Anyone on the **same Wi-Fi** opens the link, types a name, picks an emoji, and pops into the player list. The host can still type players in by hand, and remove anyone. **Start game** tells every phone the game is on.

- The dev server listens on the local network (`host: true` in `vite.config.ts`), so other devices on your Wi-Fi can reach it. The terminal prints the address under "Network".
- Lobbies live in memory in the dev/preview server (`server/lobby.ts`, routes in `server/plugin.ts`). A static deploy of `dist/` has no lobby server, so inviting only works with `npm run dev` or `npm run preview`.
- Once the game starts, phones show the round and the live standings. Phone players send their own score (Five Crowns phones add up the cards left in hand; Farkle phones have point shortcuts), and it lands on the host's screen as pending.
- The host approves each score, sends it back, or types over it (typing counts as approved). **Approve all** takes everything pending except clashing "went out" claims. **Finish round** unlocks only when every score is in and approved. Players without a phone are typed in by the host as before.
- Phones only see who has sent a score, never the values, until the round is finished.

## Desktop layout

Wider than 900px, screens switch to two panes (`src/lib/viewport.svelte.ts` tracks the width; `.screen.wide` in `app.css` widens the page): the library lists games on the left with the selected game's rules on the right, setup puts the phone invite beside the players, the round screen keeps the full score sheet beside round entry, and results show stats and the score sheet beside the standings. Narrower screens and phones keep the single column.

Each game's `about` (tagline, time, rules, scoring reference) feeds the library's detail pane, so a new game gets one by filling that in.

## How games work

Every game is a `GameModule` (see `src/lib/types.ts`): identity, player range, setup options, a scoring surface, a turn model, and a winner rule. The shell (library, players, saving, history) never changes per game.

Game-specific rules stay in the module. For `round-grid` games, `roundGrid` sets the entry label and an optional "went out" button (Five Crowns: "Out" scores 0), and an optional `quickScore` button any number of players can use per round (Farkle: "Farkle" scores 0). Games with `winner: first-to-target` and no fixed `rounds` end when a round finishes with someone at the target. `turns.option` and `cheatSheet.option` name the setup toggle that turns the dealer or cheat sheet on and off.

Scoring surfaces (reusable screens a module picks from):

| Surface | For | Status |
| --- | --- | --- |
| `round-grid` | Rounds games: Five Crowns, Farkle, Cover Your Assets, Phase 10 | done |
| `bid-tricks` | Bid-and-tricks games: Skull King (bids first, then tricks won and bonus captures; scores can go negative) | done |
| `category-sheet` | Turn-based sheets: Yahtzee | planned |
| `running-tally` | Free-form counters: Catan | planned |

### Add a game

1. Create `src/games/<name>.ts` exporting a `GameModule`.
2. List it in `src/games/index.ts`.
3. Add tests for any rules that are not plain data.

## Layout

```
src/
  games/       game modules + registry (Five Crowns first)
  lib/         types, pure scoring and session helpers, Dexie storage
  screens/     Library, PlayerSetup, Play, Results
  surfaces/    scoring surfaces (RoundGrid); Play picks one per game
server/        lobby for joining from phones (in-memory, runs inside Vite)
  components/  shared pieces (ScoreSheet)
  App.svelte   screen switching, loading and saving sessions
```

Every change to a session (including a half-entered round) is saved to IndexedDB right away. On load the newest unfinished game reopens.

## Next steps

1. ~~Player setup screen~~
2. ~~Round grid scoring screen (Five Crowns)~~
3. ~~Results screen and saved sessions~~
4. PNG icons for the PWA manifest
