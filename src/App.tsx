import { DonateButton } from './ui/DonateButton';
import { ImportPanel } from './ui/ImportPanel';

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
        <section className="stage" aria-label="Cena da caixa de CD" data-testid="stage" />
        <aside className="panel" aria-label="Controles do player" data-testid="controls">
          <ImportPanel />
        </aside>
        <section className="video-slot" aria-label="Player do YouTube" hidden data-testid="video-slot" />
      </main>
    </div>
  );
}
