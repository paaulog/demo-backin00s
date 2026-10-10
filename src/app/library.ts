import { config } from '../config';
import type { Album } from '../core/types';
import { localSource, type ImportItem } from '../sources/local/LocalSource';
import { useApp } from '../store/store';

type AlbumHook = (album: Album) => void;
const afterImport: AlbumHook[] = [];

/** Etapas extras (arte remota, arte gerada) se registram aqui sem acoplar a importação. */
export function onAlbumImported(hook: AlbumHook): () => void {
  afterImport.push(hook);
  return () => afterImport.splice(afterImport.indexOf(hook), 1);
}

export async function importItems(items: ImportItem[]): Promise<Album[]> {
  const app = useApp.getState();
  app.clearWarnings();
  app.setImporting({ done: 0, total: items.length });
  try {
    const albums = await localSource.importItems(items, {
      batchSize: 8,
      onProgress: (done, total) => useApp.getState().setImporting({ done, total }),
      onWarning: (m) => useApp.getState().pushWarning(m),
    });
    if (albums.length) {
      useApp.getState().addAlbums(albums);
      const first = albums[0];
      if (first && !useApp.getState().currentAlbumId) useApp.getState().selectAlbum(first.id);
      useApp.getState().announce(
        albums.length === 1 ? `Álbum carregado: ${first?.title ?? ''}` : `${albums.length} álbuns carregados`,
      );
      for (const album of albums) for (const hook of afterImport) hook(album);
    }
    return albums;
  } catch (error) {
    useApp.getState().pushWarning(error instanceof Error ? error.message : 'Falha ao importar');
    return [];
  } finally {
    useApp.getState().setImporting(null);
  }
}

/**
 * Álbum de demonstração com áudio sintetizado (public/demo). Passa pelo mesmo caminho dos
 * arquivos do usuário; os arquivos vêm do próprio site, nada é enviado.
 */
export async function loadDemoAlbum(): Promise<Album[]> {
  const base = `${config.baseUrl}demo/`;
  const manifest = await fetch(`${base}manifest.txt`).then((r) => (r.ok ? r.text() : ''));
  const names = manifest.split('\n').map((n) => n.trim()).filter((n) => /^[\w.-]+\.mp3$/.test(n));
  const items: ImportItem[] = await Promise.all(
    names.map(async (name) => {
      const blob = await fetch(`${base}${name}`).then((r) => r.blob());
      return { file: new File([blob], name, { type: 'audio/mpeg' }), relativePath: `Lado B do Futuro/${name}` };
    }),
  );
  return importItems(items);
}
