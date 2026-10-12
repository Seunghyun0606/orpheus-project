import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  legacySnapshotBytes,
  prepareCampaignOperation,
  resumeCampaignAssociation,
  verifyCampaignSource,
  checkCampaignSourceAdmission,
  type CampaignOperation,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import type { Scenario } from '../scenario/schema.ts';
import type { SaveStorage } from './storage.ts';

type Reader = Pick<SaveStorage, 'read'>;
export interface LegacyReaders {
  incident: Reader;
  progress: Reader;
}
type LegacySources = { incident: string | null; progress: string | null };
type CampaignPreviewAuthority = { definition: unknown; run: CampaignRun };
const guardedAuthority = (
  definition: unknown,
  run: CampaignRun,
): CampaignPreviewAuthority | undefined =>
  definition !== null && typeof definition === 'object' && 'actionGates' in definition
    ? { definition, run }
    : undefined;
type Failure = { ok: false; code: string };
const fail = (code: string): Failure => ({ ok: false, code });
function readSources(readers: LegacyReaders): LegacySources | undefined {
  try {
    const sources = { incident: readers.incident.read(), progress: readers.progress.read() };
    return [sources.incident, sources.progress].every(
      (value) => value === null || typeof value === 'string',
    )
      ? sources
      : undefined;
  } catch {
    return undefined;
  }
}
function inspect(
  sources: LegacySources,
  catalog: ReadonlyMap<string, Scenario>,
  authority?: CampaignPreviewAuthority,
) {
  const bytes = legacySnapshotBytes(sources);
  if (!bytes?.length) return fail('NO_OR_INVALID_LEGACY_SOURCE');
  const discoveries = [];
  for (const sourceBytes of bytes) {
    if (authority) {
      const admitted = checkCampaignSourceAdmission(
        authority.definition,
        catalog,
        authority.run,
        sourceBytes,
      );
      if (!admitted.ok) return fail(admitted.diagnostics[0]?.code ?? 'INVALID_LEGACY_SOURCE');
    }
    const source = verifyCampaignSource(sourceBytes, catalog);
    if (!source) return fail('INVALID_LEGACY_SOURCE');
    discoveries.push({
      scenarioId: source.scenario.id,
      contentVersion: source.scenario.contentVersion,
      evidenceIds: source.state.revealedEvidenceIds,
      narrativeIds: source.state.triggeredNarrativeIds,
    });
  }
  return { ok: true as const, sources, sourceBytes: bytes, discoveries };
}
export function previewLegacyDiscoveries(
  readers: LegacyReaders,
  catalog: ReadonlyMap<string, Scenario>,
  authority?: CampaignPreviewAuthority,
) {
  const sources = readSources(readers);
  return sources ? inspect(sources, catalog, authority) : fail('LEGACY_STORAGE_ERROR');
}
type Preview = Extract<ReturnType<typeof previewLegacyDiscoveries>, { ok: true }>;
type AdoptionIdentity = Omit<
  Extract<CampaignOperation, { kind: 'adopt' }>,
  'sourceBytes' | 'legacySources'
>;
export function prepareLegacyAdoption(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  preview: Preview,
  readers: LegacyReaders,
  identity: AdoptionIdentity,
) {
  try {
    const current = previewLegacyDiscoveries(readers, catalog, guardedAuthority(definition, run));
    if (!current.ok) return current;
    if (canonicalJson(current) !== canonicalJson(preview)) return fail('LEGACY_SOURCE_CHANGED');
    return prepareCampaignOperation(definition, catalog, run, {
      ...identity,
      sourceBytes: current.sourceBytes,
      legacySources: current.sources,
    });
  } catch {
    return fail('INVALID_LEGACY_PREVIEW');
  }
}
export function previewLegacyCheckpoint(
  reader: Reader,
  catalog: ReadonlyMap<string, Scenario>,
  authority?: CampaignPreviewAuthority,
) {
  try {
    const sourceBytes = reader.read();
    if (sourceBytes === null) return fail('CHECKPOINT_NOT_FOUND');
    if (authority) {
      const admitted = checkCampaignSourceAdmission(
        authority.definition,
        catalog,
        authority.run,
        sourceBytes,
      );
      if (!admitted.ok) return fail(admitted.diagnostics[0]?.code ?? 'INVALID_CHECKPOINT');
    }
    const source = verifyCampaignSource(sourceBytes, catalog);
    if (!source) return fail('INVALID_CHECKPOINT');
    return {
      ok: true as const,
      sourceBytes,
      scenarioId: source.scenario.id,
      contentVersion: source.scenario.contentVersion,
      completed: source.state.completionReached,
    };
  } catch {
    return fail('LEGACY_STORAGE_ERROR');
  }
}
type CheckpointPreview = Extract<ReturnType<typeof previewLegacyCheckpoint>, { ok: true }>;
type CheckpointIdentity = Omit<Extract<CampaignOperation, { kind: 'checkpoint' }>, 'sourceBytes'>;
export function prepareLegacyCheckpoint(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  preview: CheckpointPreview,
  reader: Reader,
  identity: CheckpointIdentity,
) {
  try {
    const current = previewLegacyCheckpoint(reader, catalog, guardedAuthority(definition, run));
    if (!current.ok) return current;
    if (canonicalJson(current) !== canonicalJson(preview)) return fail('LEGACY_SOURCE_CHANGED');
    return prepareCampaignOperation(definition, catalog, run, {
      ...identity,
      sourceBytes: current.sourceBytes,
    });
  } catch {
    return fail('INVALID_LEGACY_PREVIEW');
  }
}
type AssociationIdentity = Omit<Extract<CampaignOperation, { kind: 'associate' }>, 'sourceBytes'>;
// Called after an independent explicit old-slot save; this function never saves it.
export function prepareLegacyAssociation(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  reader: Reader,
  identity: AssociationIdentity,
) {
  try {
    const sourceBytes = reader.read();
    if (sourceBytes === null) return fail('CHECKPOINT_NOT_FOUND');
    return prepareCampaignOperation(definition, catalog, run, { ...identity, sourceBytes });
  } catch {
    return fail('LEGACY_STORAGE_ERROR');
  }
}
export function resumeLegacyAssociation(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  reader: Reader,
  associationId: string,
) {
  try {
    const bytes = reader.read();
    return bytes === null
      ? fail('CHECKPOINT_NOT_FOUND')
      : resumeCampaignAssociation(definition, catalog, run, associationId, bytes);
  } catch {
    return fail('LEGACY_STORAGE_ERROR');
  }
}
