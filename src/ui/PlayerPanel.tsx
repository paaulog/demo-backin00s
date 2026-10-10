import { useMemo } from 'react';
import { pickArtwork } from '../art/pick';
import { ensureLoaded, getPlayer } from '../app/player';
import { formatTime } from '../core/text';
import { currentAlbum, useApp } from '../store/store';
import { Display } from './Display';

export function PlayerPanel() {
  const album = useApp(currentAlbum);
  const p = useApp((s) => s.player);
  const loadedHere = album !== null && p.albumId === album.id;
  const visible = useMemo(() => album?.tracks.filter((t) => t.number !== 0) ?? [], [album]);
  const cover = pickArtwork(album, 'front');

  const play = async () => {
    if (!album) return;
    if (!loadedHere) await ensureLoaded(album, { autoplay: true });
    else await getPlayer().toggle();
  };

  return (
    <section className="card" aria-labelledby="player-title">
      <h2 id="player-title">Aparelho</h2>
      <Display
        trackNumber={loadedHere ? p.trackNumber : visible[0]?.number ?? 0}
        time={loadedHere ? p.displayTime : 0}
        playing={loadedHere && p.isPlaying}
        shuffle={p.shuffle}
        repeat={p.repeat}
        message={loadedHere ? p.message : null}
        hasAlbum={album !== null}
      />
      <input
        className="seek"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(loadedHere ? p.duration : 0))}
        step={1}
        value={loadedHere ? Math.floor(p.elapsed) : 0}
        disabled={!loadedHere}
        aria-label="Posição na faixa"
        aria-valuetext={`${formatTime(p.elapsed)} de ${formatTime(p.duration)}`}
        onChange={(e) => getPlayer().seek(Number(e.target.value))}
      />
      <div className="row" style={{ marginTop: 8 }} role="group" aria-label="Controles">
        <button type="button" className="btn" disabled={!loadedHere} onClick={() => void getPlayer().prev()} aria-label="Voltar">
          ⏮
        </button>
        <button type="button" className="btn primary" disabled={!album} onClick={() => void play()} aria-label={loadedHere && p.isPlaying ? 'Pausar' : 'Tocar'} data-testid="play">
          {loadedHere && p.isPlaying ? '❚❚' : '▶'}
        </button>
        <button type="button" className="btn" disabled={!loadedHere} onClick={() => void getPlayer().next()} aria-label="Avançar">
          ⏭
        </button>
        <button type="button" className="btn" disabled={!loadedHere} onClick={() => getPlayer().stop()} aria-label="Parar">
          ■
        </button>
        <button type="button" className="btn" aria-pressed={p.shuffle} onClick={() => getPlayer().setShuffle(!p.shuffle)}>
          Aleatório
        </button>
        <button type="button" className="btn" aria-pressed={p.repeat !== 'off'} onClick={() => getPlayer().cycleRepeat()} aria-label={`Repetir: ${p.repeat === 'off' ? 'desligado' : p.repeat === 'track' ? 'faixa' : 'álbum'}`}>
          {p.repeat === 'track' ? 'Repetir 1' : 'Repetir'}
        </button>
      </div>

      {album && (
        <div style={{ marginTop: 14 }}>
          <div className="album-head">
            {cover && <img src={cover.url} alt="" />}
            <div>
              <div className="t" data-testid="album-title">{album.title}</div>
              <div className="a">
                {album.artist}
                {album.year ? ` · ${album.year}` : ''}
                {album.genre ? ` · ${album.genre}` : ''}
              </div>
            </div>
          </div>
          <ol className="tracklist" aria-label="Faixas" data-testid="tracklist">
            {visible.map((t) => {
              const current = loadedHere && p.trackId === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`${current ? 'current' : ''} ${t.unavailable ? 'unavailable' : ''}`}
                    aria-current={current ? 'true' : undefined}
                    disabled={t.unavailable}
                    title={t.unavailableReason}
                    onClick={() => void ensureLoaded(album, { autoplay: true, trackId: t.id })}
                  >
                    <span className="num">{t.number}</span>
                    <span>{t.title}</span>
                    <span className="dur">{t.duration ? formatTime(t.duration) : ''}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
