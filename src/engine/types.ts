import type { Scenario, ScenarioCondition, ScenarioEffect } from '../scenario/index.ts';

export type ScalarValue = Scenario['initialState']['signals'][number]['value'];

export interface SeededRngState {
  readonly seed: number;
  readonly state: number;
  readonly draws: number;
}

export interface SeededRng {
  next(state: SeededRngState): { readonly state: SeededRngState; readonly value: number };
}

export interface SimulationClock {
  advance(currentSeconds: number, durationSeconds: number): number;
}

export interface EngineDependencies {
  readonly clock: SimulationClock;
  readonly rng: SeededRng;
}

export interface RuntimeSignal {
  value: ScalarValue;
  revealed: boolean;
}

export interface RuntimeResource {
  value: number;
}

export interface PerformActionCommand {
  readonly type: 'perform_action';
  readonly actionId: string;
  readonly targetId?: string;
  readonly input?: Readonly<Record<string, ScalarValue>>;
}

export type EngineCommand = PerformActionCommand;

export interface ReplayEntry {
  readonly sequence: number;
  readonly command: EngineCommand;
}

export type EngineEventType =
  | 'action_started'
  | 'action_completed'
  | 'time_advanced'
  | 'signal_changed'
  | 'signal_revealed'
  | 'resource_changed'
  | 'flag_changed'
  | 'action_unlocked'
  | 'evidence_revealed'
  | 'narrative_triggered'
  | 'mechanism_resolved'
  | 'temporary_effect_started'
  | 'temporary_effect_expired'
  | 'event_scheduled'
  | 'event_cancelled'
  | 'event_fired'
  | 'resolution_reached'
  | 'completion_reached';

export interface EngineEvent {
  readonly sequence: number;
  readonly type: EngineEventType;
  readonly atSeconds: number;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly value?: ScalarValue;
  readonly previousValue?: ScalarValue;
  readonly dueAtSeconds?: number;
}

export interface ScheduledTemporaryExpiration {
  readonly kind: 'temporary_expiration';
  readonly dueAtSeconds: number;
  readonly scheduleSequence: number;
  readonly actionId: string;
  readonly temporaryEffectId: string;
  readonly effects: readonly ScenarioEffect[];
}

export interface ScheduledTimerEvent {
  readonly kind: 'timer_event';
  readonly dueAtSeconds: number;
  readonly scheduleSequence: number;
  readonly eventId: string;
}

export type ScheduledWork = ScheduledTemporaryExpiration | ScheduledTimerEvent;

export interface IncidentState {
  readonly scenarioId: string;
  readonly contentVersion: string;
  elapsedSeconds: number;
  rng: SeededRngState;
  signals: Record<string, RuntimeSignal>;
  resources: Record<string, RuntimeResource>;
  flags: Record<string, boolean>;
  unlockedActionIds: string[];
  completedActionIds: string[];
  actionHistory: string[];
  revealedEvidenceIds: string[];
  triggeredNarrativeIds: string[];
  resolvedMechanismIds: string[];
  firedOnceEventIds: string[];
  latchedConditionalEventIds: string[];
  scheduledWork: ScheduledWork[];
  resolutionReached: boolean;
  completionReached: boolean;
  replayLog: ReplayEntry[];
  eventLog: EngineEvent[];
  nextEventSequence: number;
  nextScheduleSequence: number;
}

export interface IncidentInitialStateOverride {
  readonly signals: Scenario['initialState']['signals'];
  readonly resources: Scenario['initialState']['resources'];
  readonly flags?: Scenario['initialState']['flags'];
}

export interface CreateIncidentOptions {
  readonly seed: number;
  readonly initialState?: IncidentInitialStateOverride;
}

export type CommandFailureCode =
  'SCENARIO_MISMATCH' | 'ACTION_NOT_FOUND' | 'ACTION_LOCKED' | 'ACTION_REQUIREMENTS_UNMET';

export interface CommandSuccess {
  readonly ok: true;
  readonly state: IncidentState;
  readonly events: readonly EngineEvent[];
}

export interface CommandFailure {
  readonly ok: false;
  readonly state: IncidentState;
  readonly events: readonly [];
  readonly code: CommandFailureCode;
  readonly message: string;
  readonly unmetRequirements?: readonly ScenarioCondition[];
}

export type CommandResult = CommandSuccess | CommandFailure;

export interface ReplaySuccess {
  readonly ok: true;
  readonly state: IncidentState;
  readonly events: readonly EngineEvent[];
}

export interface ReplayFailure {
  readonly ok: false;
  readonly state: IncidentState;
  readonly events: readonly EngineEvent[];
  readonly commandIndex: number;
  readonly error: CommandFailure;
}

export type ReplayResult = ReplaySuccess | ReplayFailure;
