import { describe, expect, it } from 'vitest';
import { fiveCrowns } from '../games/fiveCrowns';
import { addLatePlayer } from './lateJoin';
import { raceData } from './race';
import { buildScoreboard } from './scoreboard';
import { createSession, recordRound } from './session';

function played(rounds: number[][]) {
  let s = createSession(fiveCrowns, ['Ana', 'Ben']);
  rounds.forEach((entries, r) => (s = recordRound(fiveCrowns, s, r, { entries, out: null })));
  return s;
}

describe('raceData', () => {
  it('gives each player running totals from the start', () => {
    const r = raceData(fiveCrowns, played([[10, 30], [20, 0]]));
    expect(r.low).toBe(true);
    expect(r.series).toEqual([
      [0, 10, 30],
      [0, 30, 30],
    ]);
    expect(r.players.map((p) => p.seat)).toEqual([0, 1]);
  });

  it('starts a late joiner’s line at the round they joined', () => {
    const s = addLatePlayer(fiveCrowns, played([[10, 30], [20, 0]]), { name: 'Maya' }, 30);
    const r = raceData(fiveCrowns, s);
    expect(r.from).toEqual([0, 0, 2]);
    expect(r.series[2]).toEqual([0, 0, 30]);
  });

  it('goes to phones once two rounds are scored', () => {
    expect(buildScoreboard(fiveCrowns, played([[10, 30]])).race).toBeNull();
    expect(buildScoreboard(fiveCrowns, played([[10, 30], [5, 5]])).race?.series).toHaveLength(2);
  });
});
