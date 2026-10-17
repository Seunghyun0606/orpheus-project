import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { inc001Scenario, scenarioSchema } from '../scenario/index.ts';
import { createIncidentSessionStore } from '../store/incident-session.ts';
import { App } from './App.tsx';
import {
  formatElapsed,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
} from './format.ts';
import { buildIncidentLog } from './incident-log.ts';

afterEach(cleanup);

describe('authored signal labels and units', () => {
  it('accepts optional label/unit on signals and still rejects unknown keys', () => {
    const scenario = structuredClone(inc001Scenario);
    const signal = scenario.initialState.signals[0]!;
    const labelled = { ...signal, label: 'Payment API error rate', unit: '%' };
    expect(
      scenarioSchema.safeParse({
        ...scenario,
        initialState: { ...scenario.initialState, signals: [labelled] },
      }).success,
    ).toBe(true);
    expect(
      scenarioSchema.safeParse({
        ...scenario,
        initialState: { ...scenario.initialState, signals: [{ ...signal, colour: 'red' }] },
      }).success,
    ).toBe(false);
    // Existing content without the new fields stays valid.
    expect(scenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it('prefers authored text and units and falls back to the ID otherwise', () => {
    const directory = signalDirectory([
      { id: 'DB_CONNECTIONS', label: 'Open database connections', unit: 'conn' },
      { id: 'API_ERROR_RATE', unit: '%' },
      { id: 'DB_CPU' },
    ]);
    expect(signalLabel('DB_CONNECTIONS', directory)).toBe('Open database connections');
    expect(signalLabel('API_ERROR_RATE', directory)).toBe('Api Error Rate');
    expect(formatSignalValue('DB_CONNECTIONS', 1498, directory)).toBe('1,498 conn');
    expect(formatSignalValue('API_ERROR_RATE', 31, directory)).toBe('31%');
    // Legacy content without units keeps the previous display.
    expect(formatSignalValue('DB_CPU', 41, directory)).toBe('41%');
    expect(formatSignalValue('STALE_SESSION_COUNT', 164)).toBe('164');
    expect(formatSignalValue('FLAG', true)).toBe('Yes');
    expect(humanize('stage-one')).toBe('Stage One');
    expect(formatElapsed(125)).toBe('02:05');
  });

  it('renders authored labels and units in the incident view', () => {
    const scenario = structuredClone(inc001Scenario);
    for (const signal of scenario.initialState.signals)
      if (signal.id === 'DB_CONNECTIONS')
        Object.assign(signal, { label: 'Pool connections in use', unit: 'conn' });
    const store = createIncidentSessionStore(scenario, 741, { read: () => null, write: () => {} });
    render(<App store={store} />);
    expect(screen.getByText('Pool connections in use')).toBeInTheDocument();
    expect(screen.getByText('498 conn')).toBeInTheDocument();
    expect(screen.getByText('31%')).toBeInTheDocument();
  });
});

describe('incident log projection', () => {
  it('uses each engine event time, not the current clock', () => {
    const store = createIncidentSessionStore(inc001Scenario, 743, {
      read: () => null,
      write: () => {},
    });
    expect(store.getState().performAction('OPEN_LOGS').ok).toBe(true);
    expect(store.getState().performAction('INSPECT_DB').ok).toBe(true);
    const { scenario, incident } = store.getState();
    const lines = buildIncidentLog(
      scenario,
      incident,
      signalDirectory(scenario.initialState.signals),
      [],
    );
    expect(lines[0]).toMatchObject({ level: 'CRITICAL', atSeconds: 0, fromEvent: false });
    const completed = lines.filter((line) => line.level === 'ACTION');
    expect(completed.map((line) => line.text)).toEqual([
      'Completed: Open Payment API logs',
      'Completed: Inspect PostgreSQL',
    ]);
    const times = completed.map((line) => line.atSeconds);
    expect(times[0]).toBeLessThan(times[1]!);
    expect(times[1]).toBe(incident.elapsedSeconds);
    for (const line of lines.filter(({ fromEvent }) => fromEvent))
      expect(incident.eventLog.some((event) => `event:${event.sequence}` === line.key)).toBe(true);
  });
});
