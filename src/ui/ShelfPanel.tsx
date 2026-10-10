import { useMemo } from 'react';
import { pullAlbum } from '../box/boxActor';
import { sortAlbums } from '../shelf/layout';
import { useApp, type ShelfSort } from '../store/store';

/**
 * Navegação da estante pelo teclado e leitor de tela: mesma ordem da torre 3D,
 * foco visível destaca a lombada correspondente.
 */
export function ShelfPanel() {
  const albums = useApp((s) => s.albums);
  const sort = useApp((s) => s.shelfSort);
  const setSort = useApp((s) => s.setShelfSort);
  const setFocus = useApp((s) => s.setShelfFocus);
  const currentId = useApp((s) => s.currentAlbumId);
  const ordered = useMemo(() => sortAlbums(albums, sort), [albums, sort]);
  if (!albums.length) return null;

  return (
    <section className="card" aria-labelledby="shelf-title">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 id="shelf-title" style={{ margin: 0 }}>
          Estante ({albums.length})
        </h2>
        <label className="footnote">
          Ordenar por{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as ShelfSort)} data-testid="shelf-sort">
            <option value="artist">artista</option>
            <option value="genre">gênero</option>
            <option value="year">ano</option>
          </select>
        </label>
      </div>
      <ul className="tracklist" aria-label="Álbuns na estante" data-testid="shelf-list">
        {ordered.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={a.id === currentId ? 'current' : ''}
              aria-current={a.id === currentId ? 'true' : undefined}
              onFocus={() => setFocus(a.id)}
              onBlur={() => setFocus(null)}
              onMouseEnter={() => setFocus(a.id)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => void pullAlbum(a.id)}
            >
              <span className="num">{a.year ?? ''}</span>
              <span>
                {a.artist} · {a.title}
              </span>
              <span className="dur">{a.genre ?? ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
