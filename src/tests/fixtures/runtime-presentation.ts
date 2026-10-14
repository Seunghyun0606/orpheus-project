// Small isolated schema-2 fixture. Never production-content acceptance evidence.
import { compositionFixture } from './composition.ts';
import { createCampaignPackageRegistry } from '../../scenario/campaign-package.ts';
import type { InvestigationPresentation } from '../../scenario/presentation.ts';

export function runtimePresentationFixture() {
  const f = compositionFixture();
  const presentation: InvestigationPresentation = {
    ...structuredClone(f.presentation),
    schemaVersion: 2,
    version: 'isolated-runtime-v2',
    panels: f.presentation.panels.map((p) => ({ ...p, blocks: [...p.blocks] })),
  };
  presentation.panels[0]!.blocks.push({
    kind: 'narrative_stream',
    id: 'narrative-history',
    entries: f.scenario.narratives.map((n) => ({
      narrativeId: n.id,
      delivery: {
        mode: 'transient',
        durationMs: 800,
        reducedMotionMode: 'until_dismissed',
        historyMode: 'recorded',
      },
    })),
  });
  const delegated = f.scenario.actions.filter((a) => a.delegation);
  presentation.panels.push({
    ...presentation.panels[0]!,
    id: 'team',
    title: 'Fixture War Room',
    kind: 'war_room',
    blocks: [
      {
        kind: 'war_room_stream',
        id: 'team-stream',
        messageIds: f.scenario.warRoom.messages.map((m) => m.id),
        delegationActionIds: delegated.map((a) => a.id),
        capacityResourceIds: [...new Set(delegated.map((a) => a.delegation!.capacityResourceId))],
      },
    ],
  });
  const pkg = {
    ...f.pkg,
    version: 'isolated-runtime-package',
    presentations: f.pkg.presentations.map((p) => ({ ...p, version: presentation.version })),
  };
  const inputs = { ...f.inputs, packages: [pkg], presentations: [presentation] };
  const result = createCampaignPackageRegistry(inputs);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { ...f, inputs, presentation, pkg, composition: result.registry.all()[0]! };
}
