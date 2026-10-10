/** Detecta WebGL antes de montar a cena; sem ele, a interface cai no fallback 2D. */
export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  if (new URLSearchParams(location.search).has('no3d')) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
