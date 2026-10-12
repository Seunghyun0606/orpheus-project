// Isolated composition fixtures, never imported by the production loader.
import { opportunityCampaignFixture } from './opportunities.ts';
import { campaignCatalog, always } from './campaign.ts';
import {
  createCampaignPackageRegistry,
  type CampaignPackage,
} from '../../scenario/campaign-package.ts';
import type { InvestigationPresentation } from '../../scenario/presentation.ts';

export function compositionFixture() {
  const definition = opportunityCampaignFixture();
  const scenario = [...campaignCatalog.values()][0]!;
  const presentation: InvestigationPresentation = {
    schemaVersion: 1,
    id: 'fixture-view',
    version: 'view-v1',
    scenarioId: scenario.id,
    contentVersion: scenario.contentVersion,
    panels: [
      {
        id: 'logs',
        title: 'Fixture investigation logs',
        kind: 'logs',
        reveal: [{ type: 'resource', resourceId: 'CUSTOMER_IMPACT', operator: 'gte', value: 0 }],
        campaignReveal: always,
        actionIds: scenario.actions.map((a) => a.id),
        blocks: [
          {
            kind: 'paragraph',
            id: 'text',
            text: 'TEST ONLY — investigate the operational evidence.',
          },
          { kind: 'signals', id: 'values', signalIds: ['API_ERROR_RATE', 'STALE_SESSION_COUNT'] },
        ],
      },
      {
        id: 'hidden',
        title: 'Hidden fixture document',
        kind: 'documents',
        reveal: [{ type: 'evidence', evidenceId: 'CORRUPTED_LOG_ENTRY' }],
        campaignReveal: always,
        actionIds: [],
        blocks: [
          {
            kind: 'table',
            id: 'record',
            columns: ['Record', 'Value'],
            rows: [['TEST ONLY', 'Preserved evidence']],
          },
        ],
      },
    ],
    evidenceRelations: [
      { id: 'edge', from: 'artifact', to: 'artifact', label: 'Verified fixture record' },
    ],
  };
  const pkg: CampaignPackage = {
    schemaVersion: 1,
    id: 'fixture-package',
    version: 'package-v1',
    definitionId: definition.id,
    definitionVersion: definition.version,
    scenarios: [{ scenarioId: scenario.id, contentVersion: scenario.contentVersion }],
    presentations: [
      {
        id: presentation.id,
        version: presentation.version,
        scenarioId: scenario.id,
        contentVersion: scenario.contentVersion,
      },
    ],
  };
  const inputs = {
    packages: [pkg],
    definitions: [definition],
    scenarios: campaignCatalog,
    presentations: [presentation],
  };
  const result = createCampaignPackageRegistry(inputs);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return {
    definition,
    scenario,
    presentation,
    pkg,
    inputs,
    registry: result.registry,
    composition: result.registry.all()[0]!,
  };
}
