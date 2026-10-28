import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

afterEach(cleanup);

describe('Droply home', () => {
  it('presents the main sharing actions and how-it-works section', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /sharing should be this simple/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /create a drop/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /have a code/i })).toBeInTheDocument();
    expect(screen.getByText(/three steps/i)).toBeInTheDocument();
  });
});
