import { pickArtwork } from '../art/pick';
import type { Album } from '../core/types';
import type { PlayerEngine } from './PlayerEngine';

/** Teclas de mídia e controles do sistema operacional. */
export function bindMediaSession(engine: PlayerEngine, getAlbum: () => Album | null): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => void engine.play()],
    ['pause', () => engine.pause()],
    ['nexttrack', () => void engine.next()],
    ['previoustrack', () => void engine.prev()],
    ['seekto', (d) => d.seekTime !== undefined && engine.seek(d.seekTime)],
    ['stop', () => engine.stop()],
  ];
  for (const [action, handler] of handlers) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Ação não suportada neste navegador.
    }
  }
  let lastTrack: string | null = null;
  engine.subscribe((snap) => {
    session.playbackState = snap.isPlaying ? 'playing' : snap.trackId ? 'paused' : 'none';
    if (snap.trackId === lastTrack) return;
    lastTrack = snap.trackId;
    const album = getAlbum();
    const track = album?.tracks.find((t) => t.id === snap.trackId);
    if (!album || !track || typeof MediaMetadata === 'undefined') return;
    const cover = pickArtwork(album, 'front');
    session.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: album.title,
      artwork: cover ? [{ src: cover.url, sizes: '512x512' }] : [],
    });
  });
}
