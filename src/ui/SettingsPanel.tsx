import { useApp, type QualityLevel } from '../store/store';

export function SettingsPanel() {
  const quality = useApp((s) => s.quality);
  const setQuality = useApp((s) => s.setQuality);
  const sfxEnabled = useApp((s) => s.sfxEnabled);
  const sfxVolume = useApp((s) => s.sfxVolume);
  const setSfx = useApp((s) => s.setSfx);
  const theme = useApp((s) => s.theme);
  return (
    <section className="card settings" aria-labelledby="settings-title">
      <h2 id="settings-title">Ajustes</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          <input type="checkbox" checked={sfxEnabled} onChange={(e) => setSfx(e.target.checked)} /> Sons da caixa
        </label>
        <label>
          Volume dos sons
          <input type="range" min={0} max={1} step={0.05} value={sfxVolume} disabled={!sfxEnabled} onChange={(e) => setSfx(sfxEnabled, Number(e.target.value))} aria-label="Volume dos sons da caixa" />
        </label>
        <label>
          Qualidade 3D
          <select value={quality} onChange={(e) => setQuality(e.target.value as QualityLevel)} data-testid="quality">
            <option value="high">alta</option>
            <option value="medium">média</option>
            <option value="low">baixa</option>
          </select>
        </label>
        <p className="footnote" style={{ margin: 0 }} data-testid="theme-label">
          Tema: {theme.label}
        </p>
      </div>
    </section>
  );
}
