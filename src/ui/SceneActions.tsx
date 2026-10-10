import { useSelector } from '@xstate/react';
import { bookletPages } from '../art/pick';
import { boxActor } from '../box/boxActor';
import type { BoxEvent } from '../box/machine';
import { currentAlbum, useApp } from '../store/store';

type Simple = Exclude<BoxEvent, { type: 'PULL' }>['type'];

const ACTIONS: { type: Simple; label: string }[] = [
  { type: 'UNWRAP', label: 'Tirar o plástico' },
  { type: 'OPEN', label: 'Abrir a caixa' },
  { type: 'TAKE_DISC', label: 'Tirar o disco' },
  { type: 'INSERT_DISC', label: 'Colocar no aparelho' },
  { type: 'OPEN_BOOKLET', label: 'Ler o encarte' },
  { type: 'EJECT', label: 'Ejetar' },
  { type: 'RETURN_DISC', label: 'Devolver à bandeja' },
  { type: 'CLOSE', label: 'Fechar a caixa' },
  { type: 'CLOSE_BOOKLET', label: 'Fechar o encarte' },
  { type: 'SHELVE', label: 'Guardar' },
];

/**
 * Cada ação da cena 3D também existe como botão HTML (acessibilidade e fallback).
 * Só aparecem as ações que a máquina aceita no estado atual.
 */
export function SceneActions() {
  const snap = useSelector(boxActor, (s) => s);
  const album = useApp(currentAlbum);
  const page = useApp((s) => s.bookletPage);
  const setPage = useApp((s) => s.setBookletPage);
  const setFullscreen = useApp((s) => s.setBookletFullscreen);
  if (!album || snap.context.albumId !== album.id) return null;
  const bookletOpen = (snap.value as { booklet: string }).booklet === 'open';
  const pages = bookletPages(album).length;
  const available = ACTIONS.filter((a) => snap.can({ type: a.type } as BoxEvent));

  return (
    <div className="actions" role="toolbar" aria-label="Ações da caixa" data-testid="scene-actions">
      {available.map((a) => (
        <button key={a.type} type="button" className="btn" onClick={() => boxActor.send({ type: a.type } as BoxEvent)} data-action={a.type}>
          {a.label}
        </button>
      ))}
      {bookletOpen && (
        <>
          <button type="button" className="btn" disabled={page <= 0} onClick={() => setPage(page - 1)} aria-label="Página anterior">
            ‹
          </button>
          <span className="btn" aria-live="polite" style={{ cursor: 'default' }}>
            {Math.min(page + 1, Math.max(1, pages))}/{Math.max(1, pages)}
          </span>
          <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página" data-action="NEXT_PAGE">
            ›
          </button>
          <button type="button" className="btn" onClick={() => setFullscreen(true)} data-action="FULLSCREEN">
            Tela cheia
          </button>
        </>
      )}
    </div>
  );
}
