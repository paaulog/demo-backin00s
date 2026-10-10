import { DonateButton } from './ui/DonateButton';
import { AnnouncerRegion } from './ui/AnnouncerRegion';
import { BookletViewer } from './ui/BookletViewer';
import { ImportPanel } from './ui/ImportPanel';
import { PlayerPanel } from './ui/PlayerPanel';
import { Stage } from './ui/Stage';
import { SettingsPanel } from './ui/SettingsPanel';
import { ShelfPanel } from './ui/ShelfPanel';
import { ThemeController } from './theme/ThemeController';

/** S1: layout base com as três áreas (canvas, controles, player do YouTube). */
export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          Back in <span>00s</span>
        </h1>
        <DonateButton />
      </header>
      <main className="layout">
        <section className="stage" aria-label="Cena da caixa de CD" data-testid="stage">
          <Stage />
        </section>
        <aside className="panel" aria-label="Controles do player" data-testid="controls">
          <PlayerPanel />
          <ImportPanel />
          <ShelfPanel />
          <SettingsPanel />
        </aside>
        <section className="video-slot" aria-label="Player do YouTube" hidden data-testid="video-slot" />
      </main>
      <ThemeController />
      <AnnouncerRegion />
      <BookletViewer />
    </div>
  );
}
