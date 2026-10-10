import type { Album } from '../core/types';
import { HtmlAudioBackend } from '../player/HtmlAudioBackend';
import { bindMediaSession } from '../player/mediaSession';
import { PlayerEngine } from '../player/PlayerEngine';
import { localSource } from '../sources/local/LocalSource';
import { useApp } from '../store/store';

let engine: PlayerEngine | null = null;

/** Engine único da aba, criado sob demanda (precisa de `Audio`, que não existe no SSR/teste). */
export function getPlayer(): PlayerEngine {
  if (engine) return engine;
  engine = new PlayerEngine({
    backend: new HtmlAudioBackend(),
    sources: { local: localSource },
    onUnavailable: (trackId, reason) => {
      const { albums, updateAlbum, pushWarning } = useApp.getState();
      const album = albums.find((a) => a.tracks.some((t) => t.id === trackId));
      if (!album) return;
      updateAlbum(album.id, {
        tracks: album.tracks.map((t) => (t.id === trackId ? { ...t, unavailable: true, unavailableReason: reason } : t)),
      });
      const t = album.tracks.find((x) => x.id === trackId);
      pushWarning(`"${t?.title ?? 'Faixa'}" indisponível: ${reason}`);
    },
  });
  let lastTrack: string | null = null;
  engine.subscribe((snapshot) => {
    useApp.getState().setPlayer(snapshot);
    if (snapshot.trackId && snapshot.trackId !== lastTrack && snapshot.isPlaying) {
      lastTrack = snapshot.trackId;
      const album = useApp.getState().albums.find((a) => a.id === snapshot.albumId);
      const track = album?.tracks.find((t) => t.id === snapshot.trackId);
      if (track) {
        useApp.getState().announce(snapshot.trackNumber === 0 ? `Faixa oculta: ${track.title}` : `Tocando faixa ${track.number}: ${track.title}`);
      }
    }
  });
  bindMediaSession(engine, () => {
    const s = useApp.getState();
    return s.albums.find((a) => a.id === s.player.albumId) ?? null;
  });
  return engine;
}

/** Carrega o álbum no player se ainda não estiver carregado. */
export async function ensureLoaded(album: Album, options: { autoplay?: boolean; trackId?: string } = {}): Promise<void> {
  const player = getPlayer();
  if (useApp.getState().player.albumId !== album.id) {
    await player.load(album, options);
  } else if (options.trackId) {
    await player.selectTrack(options.trackId);
  } else if (options.autoplay) {
    await player.play();
  }
}
