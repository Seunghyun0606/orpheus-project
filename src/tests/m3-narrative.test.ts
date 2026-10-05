import { describe, expect, it } from 'vitest';

import { replayCommands } from '../engine/index.ts';
import {
  decodeCampaignProgress,
  encodeCampaignProgress,
  encodeSave,
  type SaveStorage,
} from '../persistence/index.ts';
import { getScenario, scenarioCatalog, validateScenarioObject } from '../scenario/index.ts';
import { getLegacyScenarioForMigration } from '../scenario/legacy-catalog.ts';
import {
  createIncidentSessionStore,
  selectCampaignEvidence,
  selectCampaignNarratives,
} from '../store/incident-session.ts';

const routes = [
  [
    'INC-001',
    ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'],
    'UNKNOWN_GOOD',
    'CORRUPTED_LOG_ENTRY',
  ],
  [
    'INC-002',
    [
      'OPEN_LOGS',
      'TRACE_AUTH_REQUEST',
      'COMPARE_DEPLOYMENT',
      'ASK_SAM_CHECK_KEYSET',
      'UPDATE_VERIFIER_KEYSET',
    ],
    'UNKNOWN_DEPLOYMENT_NOTE',
    'UNATTRIBUTED_DEPLOYMENT_NOTE',
  ],
  [
    'INC-003',
    ['OPEN_LOGS', 'TRACE_RETRY', 'COMPARE_BATCH', 'ASK_JIN_CONFIRM_IMPACT', 'ADD_DEAD_LETTER_RULE'],
    'UNKNOWN_QUEUE_MARKER',
    'REDACTED_QUEUE_MARKER',
  ],
] as const;

describe('M3 UNKNOWN discovery routes', () => {
  it.each(routes)(
    '%s requires authored investigation and replays deterministically',
    (id, actions, narrativeId, evidenceId) => {
      const scenario = getScenario(id);
      if (scenario === undefined) throw new Error(`Missing ${id}`);
      const commands = actions.map((actionId) => ({ type: 'perform_action' as const, actionId }));
      if (id !== 'INC-001') {
        const beforeWarRoomReport = replayCommands(scenario, { seed: 1515 }, commands.slice(0, -1));
        if (!beforeWarRoomReport.ok) throw new Error(`Failed partial ${id} route`);
        expect(beforeWarRoomReport.state.triggeredNarrativeIds).not.toContain(narrativeId);
        expect(beforeWarRoomReport.state.revealedEvidenceIds).not.toContain(evidenceId);
      }
      const first = replayCommands(scenario, { seed: 1515 }, commands);
      const second = replayCommands(scenario, { seed: 1515 }, commands);
      if (!first.ok || !second.ok) throw new Error(`Failed ${id} discovery route`);
      expect(second.state).toEqual(first.state);
      expect(first.state.triggeredNarrativeIds).toContain(narrativeId);
      expect(first.state.revealedEvidenceIds).toContain(evidenceId);
      expect(
        first.state.eventLog.find(
          ({ type, sourceId }) => type === 'narrative_triggered' && sourceId === narrativeId,
        ),
      ).toBeDefined();
    },
  );

  it('rejects premature identity disclosure and a broken narrative-to-evidence reference', () => {
    const scenario = getScenario('INC-002');
    if (scenario === undefined) throw new Error('Missing INC-002');
    const premature = structuredClone(scenario);
    premature.narratives[0]!.body = 'NULL is an ORPHEUS experiment.';
    const disclosure = validateScenarioObject(premature);
    expect(disclosure.success).toBe(false);
    if (!disclosure.success)
      expect(disclosure.diagnostics.map(({ code }) => code)).toContain('PROHIBITED_MVP_REVEAL');

    const broken = structuredClone(scenario);
    broken.evidence.find(({ id }) => id === 'UNATTRIBUTED_DEPLOYMENT_NOTE')!.sourceNarrativeId =
      'UNKNOWN_MISSING';
    const invalid = validateScenarioObject(broken);
    expect(invalid.success).toBe(false);
    if (!invalid.success)
      expect(invalid.diagnostics.map(({ code }) => code)).toContain('UNKNOWN_REFERENCE');
  });
});

describe('separate versioned campaign progress', () => {
  it('retains discoveries from divergent restarts and leaves malformed progress untouched', () => {
    const scenario = getScenario('INC-002');
    if (scenario === undefined) throw new Error('Missing INC-002');
    let progress: string | null = null;
    const progressStorage: SaveStorage = {
      read: () => progress,
      write: (value) => {
        progress = value;
      },
    };
    const incidentStorage: SaveStorage = { read: () => null, write: () => {} };
    const options = { storage: progressStorage, catalog: scenarioCatalog };
    const first = createIncidentSessionStore(scenario, 1515, incidentStorage, options);
    expect(first.getState().performAction('OPEN_LOGS').ok).toBe(true);
    expect(first.getState().performAction('TRACE_AUTH_REQUEST').ok).toBe(true);
    first.getState().restart();
    expect(first.getState().performAction('COMPARE_DEPLOYMENT').ok).toBe(true);
    const recovered = createIncidentSessionStore(scenario, 1515, incidentStorage, options);
    expect(selectCampaignEvidence(recovered.getState()).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['KEYSET_MISMATCH_TRACE', 'DEPLOYMENT_ORDER_RECORD']),
    );

    progress = '{';
    const corrupt = createIncidentSessionStore(scenario, 1515, incidentStorage, options);
    expect(corrupt.getState().campaignProgressError?.code).toBe('MALFORMED_SAVE');
    expect(corrupt.getState().performAction('COMPARE_DEPLOYMENT').ok).toBe(true);
    expect(progress).toBe('{');
  });

  it('restores prior evidence across incidents without writing the original incident slot', () => {
    let progress: string | null = null;
    let incidentSlot: string | null = null;
    const progressStorage: SaveStorage = {
      read: () => progress,
      write: (value) => {
        progress = value;
      },
    };
    const incidentStorage: SaveStorage = {
      read: () => incidentSlot,
      write: (value) => {
        incidentSlot = value;
      },
    };
    for (const [id, actions, narrativeId, evidenceId] of routes) {
      const scenario = getScenario(id);
      if (scenario === undefined) throw new Error(`Missing ${id}`);
      const store = createIncidentSessionStore(scenario, 1515, incidentStorage, {
        storage: progressStorage,
        catalog: scenarioCatalog,
      });
      for (const actionId of actions)
        expect(store.getState().performAction(actionId).ok).toBe(true);
      expect(selectCampaignEvidence(store.getState()).some((item) => item.id === evidenceId)).toBe(
        true,
      );
      expect(
        selectCampaignNarratives(store.getState()).some((item) => item.id === narrativeId),
      ).toBe(true);
      expect(incidentSlot).toBeNull();
    }
    const inc001 = getScenario('INC-001');
    if (inc001 === undefined || progress === null) throw new Error('Missing archive');
    const restored = createIncidentSessionStore(inc001, 1515, incidentStorage, {
      storage: progressStorage,
      catalog: scenarioCatalog,
    });
    expect(
      selectCampaignEvidence(restored.getState()).map(
        ({ scenarioId, id }) => `${scenarioId}:${id}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        'INC-001:CORRUPTED_LOG_ENTRY',
        'INC-002:UNATTRIBUTED_DEPLOYMENT_NOTE',
        'INC-003:REDACTED_QUEUE_MARKER',
      ]),
    );
    expect(selectCampaignNarratives(restored.getState()).map(({ id }) => id)).toEqual(
      expect.arrayContaining(routes.map(([, , narrative]) => narrative)),
    );
    expect(decodeCampaignProgress(progress, scenarioCatalog).ok).toBe(true);
    expect(incidentSlot).toBeNull();
  });

  it('verifies old 1.1.0 progress against frozen rules and rejects altered records', () => {
    const legacy = getLegacyScenarioForMigration('INC-002', '1.1.0', '1.2.0');
    const current = getScenario('INC-002');
    if (legacy === undefined || current === undefined) throw new Error('Missing INC-002 versions');
    const replay = replayCommands(legacy, { seed: 1515 }, [
      { type: 'perform_action', actionId: 'COMPARE_DEPLOYMENT' },
    ]);
    if (!replay.ok) throw new Error('Legacy replay failed');
    const raw = JSON.stringify({
      schemaVersion: 1,
      incidentSaves: { 'INC-002': [encodeSave(legacy, 1515, replay.state)] },
    });
    const decoded = decodeCampaignProgress(raw, scenarioCatalog);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(decoded.value.get('INC-002')?.[0]?.incident.contentVersion).toBe('1.2.0');
    expect(decodeCampaignProgress(encodeCampaignProgress(decoded.value), scenarioCatalog).ok).toBe(
      true,
    );
    const tampered = JSON.parse(raw);
    const save = JSON.parse(tampered.incidentSaves['INC-002'][0]);
    save.incident.revealedEvidenceIds.push('UNATTRIBUTED_DEPLOYMENT_NOTE');
    tampered.incidentSaves['INC-002'][0] = JSON.stringify(save);
    expect(decodeCampaignProgress(JSON.stringify(tampered), scenarioCatalog)).toMatchObject({
      ok: false,
      code: 'REPLAY_MISMATCH',
    });
    expect(
      decodeCampaignProgress(
        JSON.stringify({ schemaVersion: 9, incidentSaves: {} }),
        scenarioCatalog,
      ),
    ).toMatchObject({ ok: false, code: 'INCOMPATIBLE_SCHEMA' });
  });
});
