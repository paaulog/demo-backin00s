import { assign, or, setup, stateIn } from 'xstate';

/**
 * Máquina da caixa (techspec, tabela de eventos). Duas regiões paralelas:
 * `case` (estante → fechada → aberta → disco na mão → tocando) e `booklet`
 * (fechado | aberto), para ler o encarte com a música tocando (RF09).
 */
export type BoxEvent =
  | { type: 'PULL'; albumId: string; shrinkwrapRemoved: boolean }
  | { type: 'UNWRAP' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TAKE_DISC' }
  | { type: 'INSERT_DISC' }
  | { type: 'EJECT' }
  | { type: 'RETURN_DISC' }
  | { type: 'SHELVE' }
  | { type: 'OPEN_BOOKLET' }
  | { type: 'CLOSE_BOOKLET' }
  /** Enter: ação contextual do estado atual. */
  | { type: 'PRIMARY' }
  /** Esc: volta um estado. */
  | { type: 'BACK' };

export interface BoxContext {
  albumId: string | null;
  shrinkwrapRemoved: boolean;
}

export type CaseState = 'shelf' | 'closed' | 'open' | 'discInHand' | 'playing';

export const boxMachine = setup({
  types: {
    context: {} as BoxContext,
    events: {} as BoxEvent,
  },
  actions: {
    // Efeitos implementados fora (store, player, IndexedDB, sons) via `provide`.
    persistUnwrap: () => undefined,
    startPlayback: () => undefined,
    pausePlayback: () => undefined,
    sfx: (_, _params: { name: 'unwrap' | 'open' | 'close' | 'take' | 'insert' | 'eject' | 'return' | 'page' | 'pull' }) => undefined,
  },
  guards: {
    isWrapped: ({ context }) => !context.shrinkwrapRemoved,
    isUnwrapped: ({ context }) => context.shrinkwrapRemoved,
    bookletIsClosed: stateIn({ booklet: 'closed' }),
    isPlaying: stateIn({ case: 'playing' }),
    caseAllowsBooklet: or([stateIn({ case: 'open' }), stateIn({ case: 'playing' })]),
  },
}).createMachine({
  id: 'box',
  type: 'parallel',
  context: { albumId: null, shrinkwrapRemoved: false },
  states: {
    case: {
      initial: 'shelf',
      states: {
        shelf: {
          on: {
            PULL: {
              target: 'closed',
              actions: [
                assign({ albumId: ({ event }) => event.albumId, shrinkwrapRemoved: ({ event }) => event.shrinkwrapRemoved }),
                { type: 'sfx', params: { name: 'pull' } },
              ],
            },
          },
        },
        closed: {
          on: {
            UNWRAP: {
              guard: 'isWrapped',
              actions: [assign({ shrinkwrapRemoved: true }), 'persistUnwrap', { type: 'sfx', params: { name: 'unwrap' } }],
            },
            OPEN: { guard: 'isUnwrapped', target: 'open', actions: { type: 'sfx', params: { name: 'open' } } },
            SHELVE: { target: 'shelf', actions: assign({ albumId: null }) },
            PRIMARY: [
              { guard: 'isWrapped', actions: [assign({ shrinkwrapRemoved: true }), 'persistUnwrap', { type: 'sfx', params: { name: 'unwrap' } }] },
              { target: 'open', actions: { type: 'sfx', params: { name: 'open' } } },
            ],
            BACK: { target: 'shelf', actions: assign({ albumId: null }) },
          },
        },
        open: {
          on: {
            // Fechar e tirar o disco exigem o encarte fechado (ele fica preso na tampa).
            CLOSE: { guard: 'bookletIsClosed', target: 'closed', actions: { type: 'sfx', params: { name: 'close' } } },
            TAKE_DISC: { guard: 'bookletIsClosed', target: 'discInHand', actions: { type: 'sfx', params: { name: 'take' } } },
            PRIMARY: { guard: 'bookletIsClosed', target: 'discInHand', actions: { type: 'sfx', params: { name: 'take' } } },
            BACK: { guard: 'bookletIsClosed', target: 'closed', actions: { type: 'sfx', params: { name: 'close' } } },
          },
        },
        discInHand: {
          on: {
            INSERT_DISC: { target: 'playing', actions: ['startPlayback', { type: 'sfx', params: { name: 'insert' } }] },
            RETURN_DISC: { target: 'open', actions: { type: 'sfx', params: { name: 'return' } } },
            PRIMARY: { target: 'playing', actions: ['startPlayback', { type: 'sfx', params: { name: 'insert' } }] },
            BACK: { target: 'open', actions: { type: 'sfx', params: { name: 'return' } } },
          },
        },
        playing: {
          on: {
            EJECT: { guard: 'bookletIsClosed', target: 'discInHand', actions: ['pausePlayback', { type: 'sfx', params: { name: 'eject' } }] },
            BACK: { guard: 'bookletIsClosed', target: 'discInHand', actions: ['pausePlayback', { type: 'sfx', params: { name: 'eject' } }] },
          },
        },
      },
    },
    booklet: {
      initial: 'closed',
      states: {
        closed: {
          on: {
            OPEN_BOOKLET: { guard: 'caseAllowsBooklet', target: 'open', actions: { type: 'sfx', params: { name: 'page' } } },
            PRIMARY: { guard: 'isPlaying', target: 'open', actions: { type: 'sfx', params: { name: 'page' } } },
          },
        },
        open: {
          on: {
            CLOSE_BOOKLET: { target: 'closed' },
            BACK: { target: 'closed' },
            SHELVE: { target: 'closed' },
          },
        },
      },
    },
  },
});
