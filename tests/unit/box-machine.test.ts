import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { boxMachine, type BoxEvent } from '../../src/box/machine';

function start(effects: string[] = []) {
  const actor = createActor(
    boxMachine.provide({
      actions: {
        persistUnwrap: () => void effects.push('persist'),
        startPlayback: () => void effects.push('play'),
        pausePlayback: () => void effects.push('pause'),
        sfx: (_, p) => void effects.push(`sfx:${p.name}`),
      },
    }),
  );
  actor.start();
  return actor;
}

const state = (actor: ReturnType<typeof start>) => actor.getSnapshot().value as { case: string; booklet: string };

function send(actor: ReturnType<typeof start>, ...events: BoxEvent[]) {
  for (const e of events) actor.send(e);
}

const pull = (removed = false): BoxEvent => ({ type: 'PULL', albumId: 'a1', shrinkwrapRemoved: removed });

describe('máquina da caixa', () => {
  it('começa na estante e PULL traz a caixa fechada com o álbum', () => {
    const a = start();
    expect(state(a)).toEqual({ case: 'shelf', booklet: 'closed' });
    send(a, pull());
    expect(state(a).case).toBe('closed');
    expect(a.getSnapshot().context.albumId).toBe('a1');
  });

  it('OPEN exige plástico removido (RF10)', () => {
    const effects: string[] = [];
    const a = start(effects);
    send(a, pull(), { type: 'OPEN' });
    expect(state(a).case).toBe('closed');
    send(a, { type: 'UNWRAP' });
    expect(a.getSnapshot().context.shrinkwrapRemoved).toBe(true);
    expect(effects).toContain('persist');
    send(a, { type: 'OPEN' });
    expect(state(a).case).toBe('open');
  });

  it('UNWRAP só vale uma vez', () => {
    const effects: string[] = [];
    const a = start(effects);
    send(a, pull(true), { type: 'UNWRAP' });
    expect(effects).not.toContain('persist');
  });

  it('fluxo completo: abrir, tirar disco, tocar, ejetar, devolver, fechar, guardar', () => {
    const effects: string[] = [];
    const a = start(effects);
    send(a, pull(true), { type: 'OPEN' }, { type: 'TAKE_DISC' });
    expect(state(a).case).toBe('discInHand');
    send(a, { type: 'INSERT_DISC' });
    expect(state(a).case).toBe('playing');
    expect(effects).toContain('play');
    send(a, { type: 'EJECT' });
    expect(state(a).case).toBe('discInHand');
    expect(effects).toContain('pause');
    send(a, { type: 'RETURN_DISC' }, { type: 'CLOSE' }, { type: 'SHELVE' });
    expect(state(a).case).toBe('shelf');
    expect(a.getSnapshot().context.albumId).toBeNull();
  });

  it('CLOSE só com o disco na bandeja', () => {
    const a = start();
    send(a, pull(true), { type: 'OPEN' }, { type: 'TAKE_DISC' }, { type: 'CLOSE' });
    expect(state(a).case).toBe('discInHand');
  });

  it('eventos fora de hora são ignorados', () => {
    const a = start();
    send(a, { type: 'OPEN' }, { type: 'INSERT_DISC' }, { type: 'EJECT' }, { type: 'TAKE_DISC' });
    expect(state(a)).toEqual({ case: 'shelf', booklet: 'closed' });
    send(a, pull(true), { type: 'INSERT_DISC' }, { type: 'SHELVE' });
    expect(state(a).case).toBe('shelf');
  });

  describe('encarte em região paralela (RF09)', () => {
    it('abre com a caixa aberta ou tocando, não fechada', () => {
      const a = start();
      send(a, pull(true), { type: 'OPEN_BOOKLET' });
      expect(state(a).booklet).toBe('closed');
      send(a, { type: 'OPEN' }, { type: 'OPEN_BOOKLET' });
      expect(state(a)).toEqual({ case: 'open', booklet: 'open' });
    });

    it('a música segue tocando com o encarte aberto', () => {
      const effects: string[] = [];
      const a = start(effects);
      send(a, pull(true), { type: 'OPEN' }, { type: 'TAKE_DISC' }, { type: 'INSERT_DISC' }, { type: 'OPEN_BOOKLET' });
      expect(state(a)).toEqual({ case: 'playing', booklet: 'open' });
      expect(effects.filter((e) => e === 'pause')).toHaveLength(0);
    });

    it('com encarte aberto não fecha, não tira disco e não ejeta', () => {
      const a = start();
      send(a, pull(true), { type: 'OPEN' }, { type: 'OPEN_BOOKLET' }, { type: 'CLOSE' }, { type: 'TAKE_DISC' });
      expect(state(a)).toEqual({ case: 'open', booklet: 'open' });
      send(a, { type: 'CLOSE_BOOKLET' }, { type: 'TAKE_DISC' }, { type: 'INSERT_DISC' }, { type: 'OPEN_BOOKLET' }, { type: 'EJECT' });
      expect(state(a)).toEqual({ case: 'playing', booklet: 'open' });
    });
  });

  describe('teclado: Enter (PRIMARY) e Esc (BACK)', () => {
    it('Enter percorre o ritual inteiro', () => {
      const a = start();
      send(a, pull());
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        a.send({ type: 'PRIMARY' });
        const s = state(a);
        seen.push(`${s.case}/${s.booklet}/${a.getSnapshot().context.shrinkwrapRemoved ? 'unwrapped' : 'wrapped'}`);
      }
      expect(seen).toEqual([
        'closed/closed/unwrapped',
        'open/closed/unwrapped',
        'discInHand/closed/unwrapped',
        'playing/closed/unwrapped',
        'playing/open/unwrapped',
      ]);
    });

    it('Esc volta um estado por vez, fechando o encarte antes de ejetar', () => {
      const a = start();
      send(a, pull(true), { type: 'OPEN' }, { type: 'TAKE_DISC' }, { type: 'INSERT_DISC' }, { type: 'OPEN_BOOKLET' });
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        a.send({ type: 'BACK' });
        const s = state(a);
        seen.push(`${s.case}/${s.booklet}`);
      }
      expect(seen).toEqual(['playing/closed', 'discInHand/closed', 'open/closed', 'closed/closed', 'shelf/closed']);
    });
  });
});
