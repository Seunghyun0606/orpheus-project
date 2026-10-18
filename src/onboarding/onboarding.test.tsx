import { readFileSync } from 'node:fs';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PresentationProvider } from '../app/PresentationSettings.tsx';
import { presentationStorageKey } from '../app/presentation-settings.ts';
import {
  createIncidentState,
  executeCommand,
  getAvailableActionIds,
  type IncidentState,
} from '../engine/index.ts';
import { installContentDictionary } from '../i18n/content.ts';
import { getScenario, type Scenario } from '../scenario/index.ts';
import { OnboardingCoach } from './OnboardingCoach.tsx';
import {
  getOnboardingPreferences,
  onboardingGuide,
  parseOnboardingGuide,
  renderHintText,
  resetOnboardingPreferencesCache,
  selectHint,
  setOnboardingPreferences,
  type OnboardingHint,
  type OnboardingSurface,
} from './onboarding.ts';

afterEach(() => {
  window.localStorage.clear();
  resetOnboardingPreferencesCache();
});

const campaignVersions = ['inc-001', 'inc-002', 'inc-003'].map(
  (name) =>
    parse(
      readFileSync(`src/scenario/data/full-campaign/incidents/${name}.yaml`, 'utf8'),
    ) as Scenario,
);

const actionRefs = (hint: OnboardingHint): string[] => [
  ...Object.values(hint.when).flatMap((value) => (Array.isArray(value) ? value : [])),
  ...[hint.focus, hint.campaignFocus]
    .filter((focus): focus is string => focus?.startsWith('action:') ?? false)
    .map((focus) => focus.slice('action:'.length)),
  ...[hint.text, hint.campaign].flatMap((text) =>
    text === undefined
      ? []
      : [...`${text.en} ${text.ko}`.matchAll(/\{action:([A-Za-z0-9_-]+)\}/g)].map((m) => m[1]!),
  ),
];

function play(scenario: Scenario, actions: readonly string[]): IncidentState {
  let state = createIncidentState(scenario, { seed: 1001 });
  for (const actionId of actions) {
    const result = executeCommand(state, scenario, { type: 'perform_action', actionId });
    if (!result.ok) throw new Error(`${actionId}: ${result.message}`);
    state = result.state;
  }
  return state;
}

function hintAfter(
  scenario: Scenario,
  actions: readonly string[],
  surface: OnboardingSurface = 'desk',
  dismissed: readonly string[] = [],
) {
  const state = play(scenario, actions);
  return selectHint(
    onboardingGuide,
    state,
    getAvailableActionIds(state, scenario),
    new Set(dismissed),
    surface,
    'en',
  )?.hint.id;
}

describe('onboarding guide', () => {
  it('covers the training rotation and only names actions those Incidents have', () => {
    expect(Object.keys(onboardingGuide.incidents)).toEqual(['INC-001', 'INC-002', 'INC-003']);
    for (const [incidentId, hints] of Object.entries(onboardingGuide.incidents)) {
      const versions = [
        getScenario(incidentId)!,
        ...campaignVersions.filter((s) => s.id === incidentId),
      ];
      expect(versions.length).toBe(2);
      for (const scenario of versions) {
        const actionIds = new Set(scenario.actions.map((a) => a.id));
        for (const hint of hints)
          for (const id of actionRefs(hint))
            expect(actionIds, `${incidentId}/${hint.id}`).toContain(id);
      }
    }
  });

  it('rejects duplicate hint IDs and unknown condition keys', () => {
    const hint = '{ id: a, when: {}, text: { en: x, ko: y } }';
    expect(() =>
      parseOnboardingGuide(
        `schemaVersion: 1\nsender: { en: M, ko: M }\nincidents: { INC-001: [${hint}, ${hint}] }`,
      ),
    ).toThrow(/Duplicate/);
    expect(() =>
      parseOnboardingGuide(
        'schemaVersion: 1\nsender: { en: M, ko: M }\nincidents: { INC-001: [{ id: a, when: { soon: true }, text: { en: x, ko: y } }] }',
      ),
    ).toThrow();
  });

  it('walks a new operator through INC-001 one step at a time', () => {
    const inc001 = getScenario('INC-001')!;
    expect(hintAfter(inc001, [])).toBe('first-look');
    expect(hintAfter(inc001, ['OPEN_METRICS'])).toBe('ask-why');
    expect(hintAfter(inc001, ['OPEN_METRICS', 'INSPECT_DB'])).toBe('new-option');
    expect(hintAfter(inc001, ['OPEN_METRICS', 'INSPECT_DB', 'INSPECT_SESSIONS'])).toBe('real-fix');
    // Mitigating before diagnosing is answered with the difference, not a scolding.
    expect(hintAfter(inc001, ['RESTART_API'])).toBe('relief-is-not-a-fix');
    const fixed = ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'];
    expect(play(inc001, fixed).completionReached).toBe(true);
    expect(hintAfter(inc001, fixed)).toBe('evidence-kept');
    expect(hintAfter(inc001, fixed, 'desk', ['INC-001/evidence-kept'])).toBe('closed');
  });

  it('teaches delegation in INC-002 and steps back in INC-003', () => {
    const inc002 = getScenario('INC-002')!;
    expect(hintAfter(inc002, [])).toBe('dont-roll-back-blind');
    expect(hintAfter(inc002, ['OPEN_LOGS'])).toBe('follow-one-request');
    expect(hintAfter(inc002, ['OPEN_LOGS', 'TRACE_AUTH_REQUEST'])).toBe('delegate');
    expect(
      hintAfter(inc002, ['OPEN_LOGS', 'TRACE_AUTH_REQUEST'], 'desk', ['INC-002/delegate']),
    ).toBe('compare');
    expect(hintAfter(inc002, ['OPEN_LOGS', 'TRACE_AUTH_REQUEST', 'COMPARE_DEPLOYMENT'])).toBe(
      'choose',
    );
    const inc003 = getScenario('INC-003')!;
    expect(hintAfter(inc003, [])).toBe('own-rhythm');
    expect(hintAfter(inc003, ['OPEN_METRICS'])).toBeUndefined();
    expect(getScenario('INC-004')).toBeUndefined();
  });

  it('renders action references through the caller’s titles', () => {
    expect(renderHintText('Try "{action:A}" then {action:B}.', (id) => `<${id}>`)).toBe(
      'Try "<A>" then <B>.',
    );
  });
});

describe('onboarding coach', () => {
  const inc001 = getScenario('INC-001')!;
  const title = (id: string) => inc001.actions.find((a) => a.id === id)?.title;

  function Coach({ state }: { state: IncidentState }) {
    return (
      <PresentationProvider>
        <OnboardingCoach
          surface="desk"
          state={state}
          availableActionIds={getAvailableActionIds(state, inc001)}
          actionTitle={title}
        />
        <button data-onboarding-target="action:OPEN_METRICS" type="button">
          target
        </button>
      </PresentationProvider>
    );
  }

  it('points at the next step, can be dismissed and turned off', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Coach state={play(inc001, [])} />);
    expect(screen.getByRole('complementary', { name: 'Tip from your lead' })).toHaveTextContent(
      'Try "Open service metrics"',
    );
    const target = screen.getByRole('button', { name: 'target' });
    expect(target).toHaveAttribute('data-onboarding-focus');
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(target).toHaveFocus();

    rerender(<Coach state={play(inc001, ['OPEN_METRICS'])} />);
    expect(target).not.toHaveAttribute('data-onboarding-focus');
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(getOnboardingPreferences().dismissed).toEqual(['INC-001/ask-why']);
    expect(screen.queryByRole('complementary')).toBeNull();

    rerender(<Coach state={play(inc001, ['OPEN_METRICS', 'INSPECT_DB'])} />);
    await user.click(screen.getByRole('button', { name: 'Turn off tips' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('orpheus.onboarding.v1')!)).toMatchObject({
      enabled: false,
    });
    act(() => setOnboardingPreferences({ enabled: true, dismissed: [] }));
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('speaks Korean with translated action titles', () => {
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'ko' }));
    installContentDictionary('ko', new Map([['Open service metrics', '서비스 지표 열기']]));
    render(<Coach state={play(inc001, [])} />);
    const tip = screen.getByRole('complementary', { name: '리드의 팁' });
    expect(tip).toHaveTextContent("'서비스 지표 열기' 조치부터 해 보세요");
    expect(tip).toHaveTextContent('마야 / SRE 리드 · DM');
    expect(screen.getByRole('button', { name: '어디예요?' })).toBeInTheDocument();
  });
});
