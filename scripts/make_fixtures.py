"""Gera o álbum de demonstração e as fixtures de áudio.

Tudo é sintetizado aqui (tons e acordes), para não versionar música protegida.
Requer Python 3.12+, numpy, Pillow e ffmpeg com libmp3lame e flac.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = ROOT / "public" / "demo"
SPIKE_DIR = ROOT / "public" / "spike"
FIXTURES_DIR = ROOT / "tests" / "fixtures"
RATE = 22050

ARTIST = "Os Sintetizados"
ALBUM = "Lado B do Futuro"
YEAR = "2003"
GENRE = "Electronic"

FONT_BOLD = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


@dataclass(frozen=True)
class Song:
    number: int
    title: str
    seconds: float
    root_hz: float
    bpm: int
    progression: tuple[int, ...]
    file: str


SONGS: tuple[Song, ...] = (
    Song(0, "Faixa Escondida", 9, 196.0, 84, (0, 5), "00-faixa-escondida.mp3"),
    Song(1, "Luz de Tubo", 24, 220.0, 112, (0, 8, 3, 10), "01-luz-de-tubo.mp3"),
    Song(2, "Disquete Azul", 22, 246.94, 124, (0, 5, 9, 7), "02-disquete-azul.mp3"),
    Song(3, "Discman na Mochila", 26, 207.65, 98, (0, 3, 8, 7), "03-discman-na-mochila.mp3"),
    Song(4, "Fim do Lado B", 20, 174.61, 90, (0, 9, 5, 7), "04-fim-do-lado-b.mp3"),
)


def semitone(freq: float, steps: int) -> float:
    return freq * 2 ** (steps / 12)


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a = min(n, max(1, int(attack * RATE)))
    r = min(n, max(1, int(release * RATE)))
    env[:a] = np.linspace(0, 1, a)
    env[-r:] *= np.linspace(1, 0, r)
    return env


def synth(song: Song) -> np.ndarray:
    total = int(song.seconds * RATE)
    t = np.arange(total) / RATE
    out = np.zeros(total)
    beat = 60 / song.bpm
    bar = beat * 4
    bars = math.ceil(song.seconds / bar)

    for b in range(bars):
        chord_root = semitone(song.root_hz, song.progression[b % len(song.progression)])
        start = int(b * bar * RATE)
        end = min(total, int((b + 1) * bar * RATE))
        seg = np.arange(end - start) / RATE
        pad = np.zeros(end - start)
        for interval in (0, 4 if b % 2 == 0 else 3, 7, 12):
            f = semitone(chord_root, interval)
            pad += 0.12 * np.sin(2 * np.pi * f * seg) + 0.04 * np.sin(2 * np.pi * 2 * f * seg + 0.3)
        out[start:end] += pad * envelope(end - start, 0.4, 0.5)

        # Arpejo em colcheias, uma oitava acima.
        for step in range(8):
            s = start + int(step * beat / 2 * RATE)
            length = int(beat / 2 * 0.9 * RATE)
            if s + length > total:
                break
            f = semitone(chord_root * 2, (0, 7, 12, 16, 12, 7, 4, 7)[step])
            nt = np.arange(length) / RATE
            note = 0.09 * np.sign(np.sin(2 * np.pi * f * nt)) * np.exp(-nt * 9)
            out[s : s + length] += note

        # Bumbo em cada tempo, exceto na faixa oculta.
        if song.number != 0:
            for k in range(4):
                s = start + int(k * beat * RATE)
                length = int(0.18 * RATE)
                if s + length > total:
                    break
                kt = np.arange(length) / RATE
                freq = 110 * np.exp(-kt * 30) + 45
                out[s : s + length] += 0.45 * np.sin(2 * np.pi * np.cumsum(freq) / RATE) * np.exp(-kt * 18)

    out *= envelope(total, 0.05, 1.5)
    peak = np.max(np.abs(out)) or 1.0
    return (out / peak * 0.85 * 32767).astype(np.int16)


def write_wav(samples: np.ndarray, path: Path) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.tobytes())


def gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        k = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return img


def make_front(path: Path) -> None:
    size = 800
    img = gradient(size, (28, 34, 74), (232, 96, 120))
    draw = ImageDraw.Draw(img)
    for i in range(14):
        r = 60 + i * 26
        draw.ellipse([size / 2 - r, size * 0.58 - r, size / 2 + r, size * 0.58 + r], outline=(255, 210, 160), width=2)
    draw.rectangle([0, size * 0.72, size, size], fill=(18, 16, 40))
    big = ImageFont.truetype(FONT_BOLD, 64)
    small = ImageFont.truetype(FONT_BOLD, 30)
    draw.text((48, 52), ALBUM.upper(), font=big, fill=(255, 244, 230))
    draw.text((52, 132), ARTIST, font=small, fill=(255, 200, 170))
    img.save(path, "JPEG", quality=88)


def make_back(path: Path) -> None:
    w, h = 1000, 780
    img = Image.new("RGB", (w, h), (24, 22, 48))
    draw = ImageDraw.Draw(img)
    title = ImageFont.truetype(FONT_BOLD, 40)
    body = ImageFont.truetype(FONT_REGULAR, 30)
    draw.text((80, 70), ALBUM, font=title, fill=(255, 220, 190))
    for i, song in enumerate(s for s in SONGS if s.number > 0):
        mins, secs = divmod(int(song.seconds), 60)
        draw.text((80, 170 + i * 56), f"{song.number:02d}  {song.title}", font=body, fill=(240, 240, 250))
        draw.text((820, 170 + i * 56), f"{mins}:{secs:02d}", font=body, fill=(200, 200, 220))
    draw.text((80, 680), "Sons sintetizados para a demonstração. Domínio público.", font=ImageFont.truetype(FONT_REGULAR, 22), fill=(160, 160, 190))
    img.save(path, "JPEG", quality=85)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def encode_mp3(wav: Path, out: Path, song: Song, front: Path, back: Path | None) -> None:
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-i", str(front)]
    if back:
        cmd += ["-i", str(back)]
    cmd += ["-map", "0:a", "-map", "1:v"]
    if back:
        cmd += ["-map", "2:v"]
    cmd += [
        "-c:a", "libmp3lame", "-b:a", "96k", "-c:v", "copy", "-id3v2_version", "3",
        "-metadata:s:v:0", "title=Front cover", "-metadata:s:v:0", "comment=Cover (front)",
    ]
    if back:
        cmd += ["-metadata:s:v:1", "title=Back cover", "-metadata:s:v:1", "comment=Cover (back)"]
    cmd += [
        "-metadata", f"title={song.title}",
        "-metadata", f"artist={ARTIST}",
        "-metadata", f"album_artist={ARTIST}",
        "-metadata", f"album={ALBUM}",
        "-metadata", f"date={YEAR}",
        "-metadata", f"genre={GENRE}",
        "-metadata", f"track={song.number}/{len(SONGS) - 1}",
        "-metadata", "disc=1/1",
        "-metadata", "publisher=Selo Imaginário",
        str(out),
    ]
    run(cmd)


def main() -> None:
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg não encontrado")
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    SPIKE_DIR.mkdir(parents=True, exist_ok=True)
    (FIXTURES_DIR / "sem-tags").mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        front = tmp / "front.jpg"
        back = tmp / "back.jpg"
        make_front(front)
        make_back(back)
        for song in SONGS:
            wav = tmp / f"{song.number}.wav"
            write_wav(synth(song), wav)
            encode_mp3(wav, DEMO_DIR / song.file, song, front, back if song.number == 1 else None)

        # FLAC curto com tags e capa, para o teste do music-metadata na spike.
        short = Song(1, "Teste FLAC", 4, 261.63, 120, (0, 7), "sample.flac")
        wav = tmp / "flac.wav"
        write_wav(synth(short), wav)
        run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-i", str(front),
            "-map", "0:a", "-map", "1:v", "-c:a", "flac", "-c:v", "mjpeg", "-disposition:v", "attached_pic",
            "-metadata", "title=Teste FLAC", "-metadata", f"artist={ARTIST}", "-metadata", "album=Spike",
            str(SPIKE_DIR / "sample.flac"),
        ])

        # Arquivo sem tags: o agrupamento precisa cair na pasta.
        wav = tmp / "untagged.wav"
        write_wav(synth(Song(1, "", 3, 329.63, 120, (0,), "")), wav)
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-map_metadata", "-1", "-c:a", "libmp3lame",
             "-b:a", "64k", str(FIXTURES_DIR / "sem-tags" / "faixa-sem-tags.mp3")])

    manifest = "\n".join(s.file for s in SONGS)
    (DEMO_DIR / "manifest.txt").write_text(manifest + "\n", encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
