import { useApp } from '../store/store';

/** Região aria-live para mudanças de faixa e de estado da caixa. */
export function AnnouncerRegion() {
  const text = useApp((s) => s.announcement);
  return (
    <div className="sr-only" aria-live="polite" role="status" data-testid="announcer">
      {text}
    </div>
  );
}
