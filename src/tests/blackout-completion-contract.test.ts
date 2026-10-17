// Isolated contract fixture; these synthetic plan IDs/effects are never production balance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { scenarioSchema } from '../scenario/schema.ts';
import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';

const contract = parse(
  readFileSync('authoring/campaign-1.0/TASK-031.final-completion-bindings.yaml', 'utf8'),
);
function fixture() {
  const s = structuredClone(inc001Scenario);
  s.id = 'TEST_ONLY_FINAL_DECISION';
  s.contentVersion = '9.9.0';
  s.narratives = [];
  s.evidence = ['CURRENT_SERVICE_ASSESSMENT', 'CURRENT_AUTHORITY_ASSESSMENT'].map((id) => ({
    id,
    title: id,
    description: 'Test-only current local assessment',
  }));
  s.initialState.flags.push(...contract.initial_flags_fragment);
  s.warRoom = { roles: [], messages: [] };
  s.actions = [
    ...s.evidence.map((e) => ({
      id: 'TEST_READ_' + e.id,
      title: 'Test-only assessment',
      category: 'INVESTIGATE' as const,
      durationSeconds: 0,
      initiallyAvailable: true,
      requirements: [],
      costs: [],
      effects: [{ type: 'reveal_evidence' as const, evidenceId: e.id }],
      temporaryEffects: [],
    })),
    ...['TEST_PLAN_A', 'TEST_PLAN_B'].map((id) => ({
      id,
      title: 'Test-only terminal choice',
      category: 'MODIFY' as const,
      durationSeconds: 30,
      initiallyAvailable: true,
      requirements: contract.final_action_requirements_fragment,
      costs: [],
      effects: [],
      temporaryEffects: [],
    })),
  ];
  s.narratives = ['TEST_PLAN_A', 'TEST_PLAN_B'].map((actionId) => ({
    id: 'TEST_COMPLETE_' + actionId,
    title: 'Test-only completed decision',
    body: 'Test-only outcome applied after normal action time and due events.',
    conditions: [
      { type: 'action_completed' as const, actionId },
      { type: 'flag' as const, flagId: 'FINAL_DECISION_COMMITTED', value: false },
    ],
    effects: contract.final_action_terminal_effect_fragment,
  }));
  s.events = [
    {
      id: 'TEST_ARM_PRESSURE',
      type: 'conditional',
      once: true,
      conditions: [{ type: 'flag', flagId: 'FINAL_DECISION_COMMITTED', value: false }],
      effects: [{ type: 'schedule_event', eventId: 'TEST_DUE_PRESSURE' }],
    },
    {
      id: 'TEST_DUE_PRESSURE',
      type: 'timer',
      delaySeconds: 15,
      cancellationConditions: [],
      effects: [{ type: 'change_resource', resourceId: 'CUSTOMER_IMPACT', amount: 9 }],
    },
  ];
  s.completion = contract.completion_fragment;
  s.postmortem.scoringInputs = [
    { id: 'TEST_TIME', label: 'Test elapsed time', source: 'elapsed_time' },
  ];
  return scenarioSchema.parse(s);
}
const reads = ['TEST_READ_CURRENT_SERVICE_ASSESSMENT', 'TEST_READ_CURRENT_AUTHORITY_ASSESSMENT'];
describe('DEC-051 final completion contract — deferred QA', () => {
  it('starts uncommitted and rejects a final choice without explicit local assessments', () => {
    const s = fixture(),
      initial = createIncidentState(s, { seed: 1002 });
    expect(initial.flags.FINAL_DECISION_COMMITTED).toBe(false);
    expect(initial.completionReached).toBe(false);
    const result = executeCommand(initial, s, { type: 'perform_action', actionId: 'TEST_PLAN_A' });
    expect(result.ok).toBe(false);
    expect(result.state).toEqual(initial);
  });
  it('completes on the chosen decision while retaining critical service state and due-event impact', () => {
    const s = fixture(),
      commands = [...reads, 'TEST_PLAN_A'].map((actionId) => ({
        type: 'perform_action' as const,
        actionId,
      }));
    const result = replayCommands(s, { seed: 1002 }, commands);
    expect(result).toEqual(replayCommands(s, { seed: 1002 }, commands));
    if (!result.ok) throw new Error('Rejected contract fixture');
    expect(result.state.completionReached).toBe(true);
    expect(result.state.flags.FINAL_DECISION_COMMITTED).toBe(true);
    expect(result.state.signals.API_ERROR_RATE!.value).toBe(31);
    expect(result.state.resources.CUSTOMER_IMPACT!.value).toBe(9);
    expect(result.state.elapsedSeconds).toBe(30);
    expect(result.state.eventLog.filter((e) => e.type === 'completion_reached')).toHaveLength(1);
    const second = executeCommand(result.state, s, {
      type: 'perform_action',
      actionId: 'TEST_PLAN_B',
    });
    expect(second.ok).toBe(false);
    expect(second.state).toEqual(result.state);
  });
  it('does not let the timer or inspection create a final decision or erase earlier completion provenance', () => {
    const s = fixture();
    const inspected = replayCommands(
      s,
      { seed: 1002 },
      reads.map((actionId) => ({ type: 'perform_action' as const, actionId })),
    );
    if (!inspected.ok) throw new Error('Rejected local assessments');
    expect(inspected.state.completionReached).toBe(false);
    expect(inspected.state.flags.FINAL_DECISION_COMMITTED).toBe(false);
    expect(contract.completion_fragment.effects).toEqual([]);
    // Official ending provenance still requires a new completion outside inherited
    // baseline; standalone replay above is not a campaign or resolver acceptance.
    expect(s.events.every((e) => e.effects.every((effect) => effect.type !== 'set_flag'))).toBe(
      true,
    );
    expect(s.narratives.every((n) => n.conditions.some((c) => c.type === 'action_completed'))).toBe(
      true,
    );
  });
});
