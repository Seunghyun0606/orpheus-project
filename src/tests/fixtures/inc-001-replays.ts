import type { EngineCommand } from '../../engine/index.ts';

export interface ReplayFixture {
  readonly id: string;
  readonly seed: number;
  readonly commands: readonly EngineCommand[];
}

function perform(actionId: string): EngineCommand {
  return { type: 'perform_action', actionId };
}

export const temporaryMitigationReplay: ReplayFixture = {
  id: 'INC-001-TEMPORARY-MITIGATION',
  seed: 1001,
  commands: [
    perform('RESTART_API'),
    perform('OPEN_METRICS'),
    perform('OPEN_METRICS'),
    perform('OPEN_METRICS'),
    perform('OPEN_METRICS'),
  ],
};

export const rootCauseResolutionReplay: ReplayFixture = {
  id: 'INC-001-ROOT-CAUSE-RESOLUTION',
  seed: 1002,
  commands: [
    perform('OPEN_LOGS'),
    perform('INSPECT_DB'),
    perform('INSPECT_SESSIONS'),
    perform('TERMINATE_STALE_SESSIONS'),
  ],
};
