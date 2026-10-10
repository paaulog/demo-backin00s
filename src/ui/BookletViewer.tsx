import { useEffect, useRef, useState } from 'react';
import { galleryOf } from '../art/pick';
import type { ArtworkType } from '../core/types';
import { currentAlbum, useApp } from '../store/store';

const NAMES: Record<ArtworkType, string> = {
  front: 'Capa',
  booklet: 'Encarte',
  back: 'Contracapa',
  medium: 'Disco',
  tray: 'Bandeja',
  spine: 'Lombada',
};

/** Encarte, capa e contracapa em tela cheia 2D, na resolução da imagem (RF09). */
export function BookletViewer() {
  const open = useApp((s) => s.bookletFullscreen);
  const setOpen = useApp((s) => s.setBookletFullscreen);
  const album = useApp(currentAlbum);
  const startPage = useApp((s) => s.bookletPage);
  const [index, setIndex] = useState(0);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const items = galleryOf(album);

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(startPage, Math.max(0, items.length - 1)));
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => previous?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !album) return null;
  const item = items[index];
  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length);

  return (
    <div
      className="booklet-full"
      role="dialog"
      aria-modal="true"
      aria-label={`Encarte de ${album.title}`}
      data-testid="booklet-full"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
        else return;
        e.preventDefault();
      }}
    >
      <header>
        <span>
          {album.title} · {item ? NAMES[item.type] : ''} {items.length ? `(${index + 1}/${items.length})` : ''}
        </span>
        <button ref={closeBtn} type="button" className="btn" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </header>
      <div className="page">{item ? <img src={item.url} alt={`${NAMES[item.type]} de ${album.title}`} /> : <p>Sem imagens.</p>}</div>
      <footer>
        <button type="button" className="btn" onClick={() => go(-1)} disabled={items.length < 2}>
          ‹ Anterior
        </button>
        <span className="footnote">{item?.origin === 'generated' ? 'Gerada a partir dos metadados' : item?.origin === 'caa' ? 'Cover Art Archive' : 'Do seu arquivo'}</span>
        <button type="button" className="btn" onClick={() => go(1)} disabled={items.length < 2}>
          Próxima ›
        </button>
      </footer>
    </div>
  );
}
