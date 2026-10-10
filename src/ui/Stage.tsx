import { lazy, Suspense, useState } from 'react';
import { hasWebGL } from '../scene/webgl';
import { useApp } from '../store/store';
import { Fallback2D } from './Fallback2D';
import { SceneActions } from './SceneActions';

// A cena 3D (three, R3F, postprocessing) carrega sob demanda, fora do bundle inicial.
const Scene = lazy(() => import('../scene/Scene'));

export function Stage() {
  const [webgl] = useState(hasWebGL);
  const failed = useApp((s) => s.webglFailed);
  const hasAlbums = useApp((s) => s.albums.length > 0);
  const use3d = webgl && !failed;

  return (
    <>
      {use3d ? (
        <Suspense fallback={<div className="empty-stage">Montando a cena…</div>}>
          <Scene />
        </Suspense>
      ) : (
        <Fallback2D />
      )}
      {!hasAlbums && (
        <div className="empty-stage" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div>
            <p style={{ fontSize: 18, color: 'var(--text)', margin: '0 0 6px' }}>A estante está vazia.</p>
            <p style={{ margin: 0 }}>Escolha uma pasta de álbum ou toque o CD de demonstração.</p>
          </div>
        </div>
      )}
      <SceneActions />
    </>
  );
}
