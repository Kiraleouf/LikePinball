import { describe, expect, it } from 'vitest';
import { RunState } from './RunState';

describe('RunState', () => {
  it('consomme exactement une bille par perte et prépare la suivante', () => {
    const run = new RunState(3);

    expect(run.launch()).toBe(true);
    run.loseBall();

    expect(run.ballsRemaining).toBe(2);
    expect(run.phase).toBe('ready');
    expect(run.launch()).toBe(true);
  });

  it('passe en game over à zéro et refuse tout nouveau lancement', () => {
    const run = new RunState(1);

    run.launch();
    run.loseBall();

    expect(run.ballsRemaining).toBe(0);
    expect(run.phase).toBe('game-over');
    expect(run.launch()).toBe(false);
  });

  it('ignore les pertes répétées pour une même bille', () => {
    const run = new RunState(3);

    run.launch();
    run.loseBall();
    run.loseBall();

    expect(run.ballsRemaining).toBe(2);
  });
});
