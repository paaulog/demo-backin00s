import { useEffect } from 'react';
import { paletteOf } from '../art/pipeline';
import { useApp } from '../store/store';
import { resolveTheme } from './genre';

/**
 * RF17: o tema segue o gênero do álbum em reprodução (ou do álbum na frente, se nada toca).
 * Aplica as cores como variáveis CSS; a transição de ~600 ms está no CSS e respeita
 * prefers-reduced-motion.
 */
export function ThemeController() {
  const playingId = useApp((s) => (s.player.trackId ? s.player.albumId : null));
  const currentId = useApp((s) => s.currentAlbumId);
  const albumId = playingId ?? currentId;
  const album = useApp((s) => s.albums.find((a) => a.id === albumId) ?? null);
  const artworkKey = album?.artwork.length ?? 0;
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  useEffect(() => {
    if (!album) return;
    const palette = paletteOf(album.id);
    setTheme(resolveTheme(album.genre, palette), palette);
    // Recalcula quando a arte chega (a paleta depende da capa).
  }, [album?.id, album?.genre, artworkKey, setTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--bg', theme.background);
    root.setProperty('--surface', theme.surface);
    root.setProperty('--text', theme.text);
    root.setProperty('--accent', theme.accent);
    root.setProperty('--font', theme.fontFamily);
    document.documentElement.dataset.theme = theme.id;
    const dark = parseInt(theme.background.slice(1, 3), 16) < 90;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [theme]);
  return null;
}
