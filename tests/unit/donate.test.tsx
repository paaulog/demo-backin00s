import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DonateButton } from '../../src/ui/DonateButton';

describe('DonateButton (RF18)', () => {
  it('abre link externo sem expor window.opener', () => {
    render(<DonateButton />);
    const link = screen.getByRole('link', { name: /apoiar/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);
  });
});
