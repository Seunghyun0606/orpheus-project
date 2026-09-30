import type { EngineCommand } from '../../engine/index.ts';

export interface Inc002ReplayFixture {
  readonly id: string;
  readonly seed: number;
  readonly commands: readonly EngineCommand[];
}

function perform(actionId: string): EngineCommand {
  return { type: 'perform_action', actionId };
}

export const temporaryRoutingReplay: Inc002ReplayFixture = {
  id: 'INC-002-ROUTING-RECURRENCE',
  seed: 2001,
  commands: [
    perform('ROUTE_STABLE_REGION'),
    ...Array.from({ length: 7 }, () => perform('OPEN_METRICS')),
  ],
};

export const renewedRoutingReplay: Inc002ReplayFixture = {
  id: 'INC-002-ROUTING-RENEWAL',
  seed: 2004,
  commands: [
    perform('ROUTE_STABLE_REGION'),
    perform('OPEN_METRICS'),
    perform('ROUTE_STABLE_REGION'),
    ...Array.from({ length: 7 }, () => perform('OPEN_METRICS')),
  ],
};

export const rollbackReplay: Inc002ReplayFixture = {
  id: 'INC-002-ROLLBACK',
  seed: 2002,
  commands: [
    perform('ROUTE_STABLE_REGION'),
    perform('OPEN_LOGS'),
    perform('TRACE_AUTH_REQUEST'),
    perform('COMPARE_DEPLOYMENT'),
    perform('ROLLBACK_BUILD_1847'),
  ],
};

export const keysetUpdateReplay: Inc002ReplayFixture = {
  id: 'INC-002-KEYSET-UPDATE',
  seed: 2003,
  commands: [
    perform('OPEN_LOGS'),
    perform('TRACE_AUTH_REQUEST'),
    perform('COMPARE_DEPLOYMENT'),
    perform('COMMUNICATE_STATUS'),
    perform('UPDATE_VERIFIER_KEYSET'),
  ],
};
