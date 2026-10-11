import { IDBFactory } from 'fake-indexeddb';
import { replayCampaign, type CampaignRun } from '../../engine/campaign/transitions.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../../persistence/campaign-ledger.ts';
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import type { Scenario } from '../../scenario/schema.ts';

// Every fixture has a fresh injected database, never global/user IndexedDB.
export async function fixtureLedger(
  d: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
) {
  const factory = new IDBFactory();
  const authorities = {
    definitions: new Map([[campaignDefinitionKey(d.id, d.version), d]]),
    scenarios: catalog,
  };
  const ledger = createCampaignLedger(authorities, () => factory);
  for (let i = 0; i < run.operations.length; i++) {
    const prefix = replayCampaign(d, catalog, run.operations.slice(0, i + 1));
    if (!prefix.ok) throw new Error('Invalid fixture prefix');
    const result = await ledger.commit({
      runId: run.runId,
      expectedRevision: i ? i - 1 : null,
      operation: run.operations[i],
      candidate: prefix.run,
    });
    if (!result.ok) throw new Error(result.code);
  }
  return { ledger, factory, authorities };
}
export function fixtureIdentity(prefix = 'fixture-input') {
  let sequence = 0;
  return () => prefix + '-' + sequence++;
}
