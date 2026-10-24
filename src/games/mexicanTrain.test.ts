import { describe, expect, it } from 'vitest';
import { mexicanTrain } from './mexicanTrain';
import { getGame } from '.';
import { configuredGame, createSession, recordRound } from '../lib/session';
import { isFinished, totals, winners } from '../lib/scoring';

describe('Mexican Train', () => {
  it('counts down 13 engine rounds on a double-12 set', () => {
    const g = configuredGame(mexicanTrain);
    expect(g.rounds).toHaveLength(13);
    expect(g.rounds![0]).toEqual({ label: 'Double 12', note: '12|12 engine' });
    expect(g.rounds![12]).toEqual({ label: 'Double blank', note: '0|0 engine' });
  });

  it('plays 10 rounds on a double-9 set', () => {
    const g = configuredGame(mexicanTrain, { length: '9', cheatSheet: true });
    expect(g.rounds).toHaveLength(10);
    expect(g.rounds![0].label).toBe('Double 9');
    expect(isFinished(g, Array.from({ length: 10 }, () => [5, 9]))).toBe(true);
  });

  it('scores 0 for going out and lowest total wins', () => {
    let s = createSession(mexicanTrain, ['Ana', 'Ben']);
    s = recordRound(mexicanTrain, s, 0, { entries: [0, 24], out: 0 });
    expect(s.scores[0]).toEqual([0, 24]);
    expect(winners(mexicanTrain.winner, totals(s.scores, 2))).toEqual([0]);
  });

  it('gives phones pip buttons and a 50-point double-blank', () => {
    const keypad = mexicanTrain.roundGrid!.phone!.keypad;
    expect(keypad).toHaveLength(13);
    expect(keypad.at(-1)).toEqual({ label: '0|0', value: 50 });
  });

  it('is in the library', () => {
    expect(getGame('mexican-train')).toBe(mexicanTrain);
  });
});
