import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the minimal Orpheus application shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'ORPHEUS' })).toBeInTheDocument();
    expect(screen.getByText('SYSTEM FOUNDATION READY')).toBeInTheDocument();
    expect(screen.getByText('Headless domain')).toBeInTheDocument();
  });
});
