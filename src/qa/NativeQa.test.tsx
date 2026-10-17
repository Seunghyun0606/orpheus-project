import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { NativeQa } from './NativeQa.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('does not open storage on mount and creates/restores only explicit fresh fixture identities', async () => {
  const factory = new IDBFactory();
  const open = vi.spyOn(factory, 'open');
  vi.stubGlobal('indexedDB', factory);
  localStorage.setItem('orpheus.incident.v1', 'legacy-sentinel');
  const user = userEvent.setup();
  const first = render(<NativeQa />);
  expect(open).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Create fresh isolated fixture' }));
  expect(await screen.findByText('Fixture deviation samples: 0/0')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Prepare guidance: prediction' }),
  ).not.toBeInTheDocument();
  const pointer = localStorage.getItem('orpheus.qa.native.selected-run.v1');
  expect(pointer).toMatch(/^qa024-/);
  expect(localStorage.getItem('orpheus.incident.v1')).toBe('legacy-sentinel');
  await user.click(screen.getByRole('button', { name: 'Open Payment API logs (+30s)' }));
  await user.click(await screen.findByRole('button', { name: 'Prepare guidance: prediction' }));
  expect(await screen.findByText('TEST CONTENT — empirical prediction')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Confirm displayed guidance' }));
  expect(await screen.findByText('Display acknowledgement durably committed')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Restart Payment API (+60s)' }));
  expect(await screen.findByText('Fixture deviation samples: 0/1')).toBeVisible();
  first.unmount();
  render(<NativeQa />);
  await user.click(screen.getByRole('button', { name: 'Restore isolated fixture' }));
  expect(await screen.findByText('Fixture deviation samples: 0/1')).toBeVisible();
  expect(screen.getByText('ACKs: 1 / Responses: 1')).toBeVisible();
  expect(localStorage.getItem('orpheus.qa.native.selected-run.v1')).toBe(pointer);
  expect(localStorage.getItem('orpheus.incident.v1')).toBe('legacy-sentinel');
});
