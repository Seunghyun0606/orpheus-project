import type { EngineCommand } from '../../engine/index.ts';

export interface Inc003ReplayFixture {
  readonly id: string;
  readonly seed: number;
  readonly commands: readonly EngineCommand[];
}

function perform(actionId: string): EngineCommand {
  return { type: 'perform_action', actionId };
}

export const temporaryConsumersReplay: Inc003ReplayFixture = {
  id: 'INC-003-TEMPORARY-CONSUMERS',
  seed: 3001,
  commands: [
    perform('SCALE_CONSUMERS'),
    ...Array.from({ length: 9 }, () => perform('OPEN_METRICS')),
  ],
};

export const renewedConsumersReplay: Inc003ReplayFixture = {
  id: 'INC-003-RENEWED-CONSUMERS',
  seed: 3004,
  commands: [
    perform('SCALE_CONSUMERS'),
    perform('OPEN_METRICS'),
    perform('SCALE_CONSUMERS'),
    ...Array.from({ length: 6 }, () => perform('OPEN_METRICS')),
  ],
};

export const quarantineReplay: Inc003ReplayFixture = {
  id: 'INC-003-QUARANTINE',
  seed: 3002,
  commands: [
    perform('SCALE_CONSUMERS'),
    perform('OPEN_LOGS'),
    perform('TRACE_RETRY'),
    perform('COMPARE_BATCH'),
    perform('QUARANTINE_MESSAGE'),
  ],
};

export const deadLetterReplay: Inc003ReplayFixture = {
  id: 'INC-003-DEAD-LETTER',
  seed: 3003,
  commands: [
    perform('OPEN_LOGS'),
    perform('TRACE_RETRY'),
    perform('COMPARE_BATCH'),
    perform('COMMUNICATE_STATUS'),
    perform('ADD_DEAD_LETTER_RULE'),
  ],
};
