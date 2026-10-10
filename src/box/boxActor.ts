import { createActor } from 'xstate';
import { ensureLoaded, getPlayer } from '../app/player';
import { shrinkwrap } from '../persist/persist';
import { playSfx } from '../sfx/sfx';
import { useApp } from '../store/store';
import { boxMachine, type CaseState } from './machine';

const LABELS: Record<CaseState, string> = {
  shelf: 'CD na estante',
  closed: 'Caixa fechada',
  open: 'Caixa aberta',
  discInHand: 'Disco na mão',
  playing: 'Disco no aparelho',
};

/** Ator único da caixa. A cena e os botões só leem o estado e mandam eventos. */
export const boxActor = createActor(
  boxMachine.provide({
    actions: {
      persistUnwrap: ({ context }) => {
        if (context.albumId) void shrinkwrap.markRemoved(context.albumId);
      },
      startPlayback: ({ context }) => {
        const album = useApp.getState().albums.find((a) => a.id === context.albumId);
        if (album) void ensureLoaded(album, { autoplay: true });
      },
      pausePlayback: () => getPlayer().pause(),
      sfx: (_, params) => playSfx(params.name),
    },
  }),
);
boxActor.start();

let lastCase: CaseState = 'shelf';
let lastBooklet = 'closed';
boxActor.subscribe((snap) => {
  const value = snap.value as { case: CaseState; booklet: string };
  if (value.case !== lastCase) {
    lastCase = value.case;
    useApp.getState().announce(LABELS[value.case]);
  }
  if (value.booklet !== lastBooklet) {
    lastBooklet = value.booklet;
    useApp.getState().announce(value.booklet === 'open' ? 'Encarte aberto' : 'Encarte fechado');
    if (value.booklet === 'open') useApp.getState().setBookletPage(0);
  }
});

export function caseState(): CaseState {
  return (boxActor.getSnapshot().value as { case: CaseState }).case;
}

/** Guarda a caixa atual, desfazendo o ritual na ordem certa (os guardas ignoram o que não cabe). */
export function shelveCurrent(): void {
  for (const type of ['CLOSE_BOOKLET', 'EJECT', 'RETURN_DISC', 'CLOSE', 'SHELVE'] as const) boxActor.send({ type });
}

/** Puxa um álbum da estante para o primeiro plano (RF14). */
export async function pullAlbum(albumId: string): Promise<void> {
  if (boxActor.getSnapshot().context.albumId === albumId && caseState() !== 'shelf') return;
  if (caseState() !== 'shelf') shelveCurrent();
  const removed = await shrinkwrap.isRemoved(albumId);
  useApp.getState().selectAlbum(albumId);
  boxActor.send({ type: 'PULL', albumId, shrinkwrapRemoved: removed });
}
