import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from '@/components/brand/Logo';

describe('Logo', () => {
  it('has an accessible name and renders the wordmark', () => {
    render(<Logo />);
    const logo = screen.getByRole('img', { name: 'Dash the Data' });
    expect(logo).toHaveTextContent('DashtheData');
  });

  it('uses the small mark at 24 px and below', () => {
    const { container } = render(<Logo variant="mark" size={20} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 32 32');
  });
});
