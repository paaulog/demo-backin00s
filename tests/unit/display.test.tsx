import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatTime } from '../../src/core/text';
import { Display } from '../../src/ui/Display';

describe('visor (RF04, RF05)', () => {
  it('mostra tempo negativo na faixa oculta', () => {
    render(<Display trackNumber={0} time={-7.2} playing shuffle={false} repeat="off" message={null} hasAlbum />);
    expect(screen.getByTestId('display-label')).toHaveTextContent('Faixa 0, menos 0 minutos e 7 segundos');
  });

  it('formata tempo como no aparelho', () => {
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(-0.2)).toBe('-0:01');
    expect(formatTime(-9)).toBe('-0:09');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });

  it('sem disco mostra traços', () => {
    render(<Display trackNumber={0} time={0} playing={false} shuffle={false} repeat="album" message="Oi" hasAlbum={false} />);
    expect(screen.getByTestId('display-label')).toHaveTextContent('Sem disco');
    expect(screen.getByText('Oi')).toBeInTheDocument();
  });
});
