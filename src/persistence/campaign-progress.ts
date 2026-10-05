import { z } from 'zod';

import type { IncidentState } from '../engine/index.ts';
import type { Scenario } from '../scenario/schema.ts';
import { decodeSave, encodeSave, type SaveResult } from './save.ts';

export const CAMPAIGN_PROGRESS_KEY = 'orpheus.campaign-progress.v1';
export const CAMPAIGN_PROGRESS_SCHEMA_VERSION = 1;

const progressSchema = z
  .object({
    schemaVersion: z.literal(CAMPAIGN_PROGRESS_SCHEMA_VERSION),
    incidentSaves: z.record(z.string(), z.array(z.string()).min(1)),
  })
  .strict();

export interface CampaignIncidentRecord {
  readonly scenario: Scenario;
  readonly seed: number;
  readonly incident: IncidentState;
}

export type CampaignProgress = ReadonlyMap<string, readonly CampaignIncidentRecord[]>;

export function decodeCampaignProgress(
  raw: string,
  catalog: ReadonlyMap<string, Scenario>,
): SaveResult<Map<string, readonly CampaignIncidentRecord[]>> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'MALFORMED_SAVE', message: 'Campaign progress is not valid JSON.' };
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    value.schemaVersion !== CAMPAIGN_PROGRESS_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      code: 'INCOMPATIBLE_SCHEMA',
      message: 'Campaign progress schema is not supported.',
    };
  }
  const parsed = progressSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, code: 'MALFORMED_SAVE', message: 'Campaign progress has invalid fields.' };
  }
  const records = new Map<string, readonly CampaignIncidentRecord[]>();
  for (const [scenarioId, saves] of Object.entries(parsed.data.incidentSaves)) {
    const scenario = catalog.get(scenarioId);
    if (scenario === undefined) {
      return {
        ok: false,
        code: 'INCOMPATIBLE_CONTENT',
        message: `Campaign progress references unknown incident ${scenarioId}.`,
      };
    }
    const snapshots: CampaignIncidentRecord[] = [];
    for (const save of saves) {
      const restored = decodeSave(save, scenario);
      if (!restored.ok) return restored;
      snapshots.push({ scenario, seed: restored.value.seed, incident: restored.value.incident });
    }
    records.set(scenarioId, snapshots);
  }
  return { ok: true, value: records };
}

export function encodeCampaignProgress(records: CampaignProgress): string {
  return JSON.stringify({
    schemaVersion: CAMPAIGN_PROGRESS_SCHEMA_VERSION,
    incidentSaves: Object.fromEntries(
      [...records].map(([id, snapshots]) => [
        id,
        snapshots.map(({ scenario, seed, incident }) => encodeSave(scenario, seed, incident)),
      ]),
    ),
  });
}
