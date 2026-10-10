import { config } from '../config';
import type { Candidate, RemoteImage } from './caa';

export interface ReleaseDetails {
  release: { id: string; title: string; artist: string; year?: number; label?: string; releaseGroupId?: string };
  imagesFrom: 'release' | 'release-group' | null;
  images: RemoteImage[];
}

/** Cliente das funções na Vercel. Sem `VITE_API_BASE`, a identificação remota fica desligada. */
export const remoteEnabled = () => Boolean(config.apiBase);

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

export async function searchRelease(artist: string, album: string, tracks: number, signal?: AbortSignal): Promise<Candidate[]> {
  const q = new URLSearchParams({ artist: artist.slice(0, 200), album: album.slice(0, 200), tracks: String(Math.min(200, Math.max(1, tracks))) });
  const data = await getJson<{ candidates: Candidate[] }>(`/api/mb/search?${q}`, signal);
  return Array.isArray(data.candidates) ? data.candidates : [];
}

export function getRelease(mbid: string, signal?: AbortSignal): Promise<ReleaseDetails> {
  return getJson<ReleaseDetails>(`/api/mb/release/${encodeURIComponent(mbid)}`, signal);
}
