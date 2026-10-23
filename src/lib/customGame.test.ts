import { describe, expect, it } from 'vitest';
import { getSessionGame } from '../games';
import { blankSpec, buildCustomGame, cleanSpec, copySpec, describeEnd, specProblems } from './customGame';
import { buildLiveRound } from './liveRound';
import { isFinished } from './scoring';
import { createSession, endGame, gameOver, recordRound, rematch, reopenGame } from './session';
import type { CustomGameSpec } from './types';

const spec = (over: Partial<CustomGameSpec> = {}): CustomGameSpec => ({ ...blankSpec(0), name: 'Phase 10', ...over });

describe('buildCustomGame', () => {
  it('plays a set number of rounds, highest wins', () => {
    const g = buildCustomGame(spec({ rounds: 3 }));
    expect(g.rounds?.map((r) => r.label)).toEqual(['Round 1', 'Round 2', 'Round 3']);
    expect(g.winner).toEqual({ rule: 'highest-total' });
    expect(g.id.startsWith('custom-')).toBe(true);
  });

  it('uses named rounds with notes', () => {
    const g = buildCustomGame(cleanSpec(spec({ rounds: 2, roundNames: [{ label: '3 cards', note: 'Wilds: 3s' }, { label: '' }] })));
    expect(g.rounds).toEqual([{ label: '3 cards', note: 'Wilds: 3s' }, { label: 'Round 2' }]);
  });

  it('plays to a target: highest with final turns, lowest ends at it', () => {
    expect(buildCustomGame(spec({ end: 'target', target: 1000, finalTurns: true })).winner).toEqual({
      rule: 'first-to-target',
      target: 1000,
      finalTurns: true,
    });
    const low = buildCustomGame(spec({ end: 'target', target: 100, win: 'lowest' }));
    expect(low.winner).toEqual({ rule: 'lowest-total', endAt: 100 });
    expect(isFinished(low, [[60, 20], [50, 10]])).toBe(true);
  });

  it('lets the host end open games', () => {
    const g = buildCustomGame(spec({ end: 'host' }));
    expect(g.hostEnds).toBe(true);
    expect(g.rounds).toBeUndefined();
    expect(isFinished(g, Array.from({ length: 40 }, () => [5, 5]))).toBe(false);
  });

  it('applies the marked player’s bonus, others’ points and penalty', () => {
    const out = { label: 'Out', score: null, bonus: -5, othersGet: 10, penalty: 15 };
    const adjust = buildCustomGame(spec({ win: 'lowest', out })).roundGrid!.adjust!;
    expect(adjust([3, 8, 9], 0)).toEqual([-2, 18, 19]); // best: everyone else +10
    expect(adjust([8, 8, 9], 0)).toEqual([18, 8, 9]); // tied: penalty
    expect(adjust([3, 8, 9], null)).toEqual([3, 8, 9]);
    // Highest wins: best means highest.
    const high = buildCustomGame(spec({ out: { ...out, bonus: 0 } })).roundGrid!.adjust!;
    expect(high([30, 8], 0)).toEqual([30, 18]);
  });

  it('gives phones the label, shortcuts and button', () => {
    const g = buildCustomGame(spec({ entryLabel: 'Points', shortcuts: [5, -10], quick: { label: 'Bust', score: 0 } }));
    expect(g.roundGrid?.phone).toEqual({
      prompt: 'Your points',
      keypad: [
        { label: '+5', value: 5 },
        { label: '-10', value: -10 },
      ],
      specialLabel: 'Bust',
    });
    const s = createSession(g, ['A', 'B']);
    expect(buildLiveRound(g, s)?.special).toMatchObject({ label: 'Bust', score: 0, exclusive: false });
  });
});

describe('custom sessions', () => {
  it('keep their own copy of the rules, through a rematch', () => {
    const recipe = spec({ rounds: 2 });
    const s = createSession(buildCustomGame(recipe), ['A', 'B']);
    recipe.rounds = 9;
    expect(getSessionGame(s)?.rounds).toHaveLength(2);
    expect(getSessionGame(rematch(s))?.name).toBe('Phase 10');
  });

  it('end when the host says, and can reopen', () => {
    const g = buildCustomGame(spec({ end: 'host' }));
    let s = createSession(g, ['A', 'B']);
    s = recordRound(g, s, 0, { entries: [5, 3], out: null });
    expect(gameOver(g, s)).toBe(false);
    s = endGame(s, 99);
    expect(s.finishedAt).toBe(99);
    expect(gameOver(g, s)).toBe(true);
    expect(buildLiveRound(g, s)).toBeNull();
    expect(gameOver(g, reopenGame(s))).toBe(false);
  });
});

describe('specProblems and cleanSpec', () => {
  it('flags what blocks saving', () => {
    const p = specProblems({ ...blankSpec(0), players: { min: 4, max: 2 }, rounds: 0, entryLabel: ' ', shortcuts: [0] });
    expect(Object.keys(p).sort()).toEqual(['entryLabel', 'name', 'players', 'rounds', 'shortcuts']);
    expect(specProblems(spec())).toEqual({});
    expect(specProblems(spec({ end: 'target', target: 200_000 })).target).toBeDefined();
    expect(specProblems(spec({ end: 'target', target: 200_000, bigNumbers: true })).target).toBeUndefined();
  });

  it('tidies text and drops settings the ending doesn’t use', () => {
    const c = cleanSpec(spec({ name: '  Rummy  ', end: 'host', roundNames: [{ label: 'x' }], finalTurns: true, notes: [' a ', ''] }), 5);
    expect(c).toMatchObject({ name: 'Rummy', roundNames: null, finalTurns: false, notes: ['a'], updatedAt: 5 });
  });

  it('copies with a new id', () => {
    const a = spec();
    const b = copySpec(a, 1);
    expect(b.id).not.toBe(a.id);
    expect(b.name).toBe('Phase 10 copy');
  });

  it('describes the ending', () => {
    expect(describeEnd(spec({ rounds: 1 }))).toBe('Highest total wins after 1 round.');
    expect(describeEnd(spec({ end: 'target', target: 10000, finalTurns: true }))).toBe(
      'First to 10,000, then everyone else gets one last turn. Highest total wins.',
    );
  });
});
