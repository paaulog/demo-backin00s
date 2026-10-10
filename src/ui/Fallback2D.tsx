import { galleryOf, pickArtwork } from '../art/pick';
import { currentAlbum, useApp } from '../store/store';

/**
 * Versão sem WebGL: capa em CSS 3D, galeria do encarte e as mesmas ações em botões.
 * Player e encarte continuam funcionando (S11).
 */
export function Fallback2D() {
  const album = useApp(currentAlbum);
  const setFullscreen = useApp((s) => s.setBookletFullscreen);
  const setPage = useApp((s) => s.setBookletPage);
  if (!album) return null;
  const cover = pickArtwork(album, 'front');
  const gallery = galleryOf(album);
  return (
    <div className="fallback" data-testid="fallback-2d">
      <div style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>
        <div className="case2d">{cover && <img src={cover.url} alt={`Capa de ${album.title}`} />}</div>
        <div className="gallery" role="list" aria-label="Encarte">
          {gallery.map((art, i) => (
            <button
              key={`${art.url}-${i}`}
              type="button"
              role="listitem"
              onClick={() => {
                setPage(i);
                setFullscreen(true);
              }}
              aria-label={`Abrir imagem ${i + 1} do encarte`}
            >
              <img src={art.url} alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
