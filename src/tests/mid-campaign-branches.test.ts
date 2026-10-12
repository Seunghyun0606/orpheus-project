// Deferred authoring verification; synthetic boundary contexts are not official samples.
import { describe, expect, it } from 'vitest';
import { authoredMidFixture } from './fixtures/authored-mid-campaign.ts';
import {
  campaignDefinitionSchema,
  validateCampaignDefinition,
  type CampaignDefinition,
} from '../scenario/campaign.ts';
import {
  evaluateCampaignCondition,
  type ConditionContext,
  type Observation,
} from '../engine/campaign/conditions.ts';
import { getCampaignBranches } from '../engine/campaign/transitions.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';

function leaves(
  d: CampaignDefinition,
  branch: NonNullable<CampaignDefinition['branches']>[number],
) {
  if (branch.eligibility.type !== 'all') throw new Error('Missing authored conjunction');
  const [act, discovery, threshold] = branch.eligibility.children;
  if (act?.type !== 'compare' || discovery?.type !== 'compare' || threshold?.type !== 'compare')
    throw new Error('Missing explicit references');
  const metric = d.references.find((r) => r.id === threshold.reference)!;
  return { act, discovery, threshold, metric };
}
function boundary(
  d: CampaignDefinition,
  branch: NonNullable<CampaignDefinition['branches']>[number],
  value: Observation,
): ConditionContext {
  const { act, discovery, metric } = leaves(d, branch);
  return {
    definitionVersion: d.version,
    kind: 'branch',
    runId: 'SYNTHETIC-BOUNDARY-NOT-A-SAMPLE',
    boundary: 0,
    observations: {
      [act.reference]: { status: 'available', value: act.expected },
      [discovery.reference]: { status: 'available', value: true },
      [metric.id]: value,
    },
  };
}

describe('DEC-047 production branch declarations — deferred QA', () => {
  it('binds five exact read-only predicates to known typed metrics in the new draft', () => {
    const f = authoredMidFixture(),
      d = f.definition;
    expect(campaignDefinitionSchema.safeParse(d).success).toBe(true);
    expect(validateCampaignDefinition(d, f.catalog)).toMatchObject({ ok: true });
    expect(d.branches!.map((b) => b.id)).toEqual([
      'COMPANY_REPORTING_ACCESS',
      'NULL_COOPERATION_ACCESS',
      'INVESTIGATION_ACCESS',
      'AI_DEPENDENT_ACCESS',
      'SAFETY_FIRST_ACCESS',
    ]);
    expect(d.branches!.map((b) => leaves(d, b).metric.key)).toEqual([
      'companyReportingRate',
      'nullCooperationRate',
      'averageInvestigationDepth',
      'aiRecommendationAcceptanceRate',
      'safetyPreference',
    ]);
    expect(d.branches!.map((b) => leaves(d, b).threshold.expected)).toEqual([
      0.5, 0.5, 4, 0.5, 0.5,
    ]);
    expect(d.branches!.map((b) => leaves(d, b).act.expected)).toEqual([4, 5, 4, 6, 6]);
    for (const b of d.branches!) expect(b.version).toBe(d.version);
  });
  const branchIds = [
    'COMPANY_REPORTING_ACCESS',
    'NULL_COOPERATION_ACCESS',
    'INVESTIGATION_ACCESS',
    'AI_DEPENDENT_ACCESS',
    'SAFETY_FIRST_ACCESS',
  ];
  for (const branchId of branchIds) {
    it(branchId + ' handles below/equal/above the approved threshold', () => {
      const d = authoredMidFixture().definition,
        b = d.branches!.find((b) => b.id === branchId)!;
      const threshold = leaves(d, b).threshold.expected;
      if (typeof threshold !== 'number') throw new Error('Not a numeric threshold');
      for (const [value, expected] of [
        [threshold - 0.001, false],
        [threshold, true],
        [threshold + 0.001, true],
      ] as const)
        expect(
          evaluateCampaignCondition(
            b.eligibility,
            d.references,
            boundary(d, b, { status: 'available', value }),
          ),
        ).toEqual({ ok: true, value: expected });
    });
    it(branchId + ' distinguishes supported zero from unavailable under a decisive sibling', () => {
      const d = authoredMidFixture().definition,
        b = d.branches!.find((b) => b.id === branchId)!;
      expect(
        evaluateCampaignCondition(
          b.eligibility,
          d.references,
          boundary(d, b, { status: 'available', value: 0 }),
        ),
      ).toEqual({ ok: true, value: false });
      const ctx = boundary(d, b, { status: 'unavailable', reason: 'NO_ELIGIBLE_SAMPLES' });
      const observations = {
        ...ctx.observations,
        [leaves(d, b).discovery.reference]: { status: 'available' as const, value: false },
      };
      expect(
        evaluateCampaignCondition(b.eligibility, d.references, { ...ctx, observations }),
      ).toEqual({
        ok: false,
        diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: leaves(d, b).metric.id }],
      });
    });
    it(
      branchId +
        ' requires its Act and discovery, and diagnoses a missing metric instead of substituting zero',
      () => {
        const d = authoredMidFixture().definition,
          b = d.branches!.find((b) => b.id === branchId)!;
        const { act, discovery, metric, threshold } = leaves(d, b),
          ctx = boundary(d, b, { status: 'available', value: Number(threshold.expected) });
        expect(
          evaluateCampaignCondition(b.eligibility, d.references, {
            ...ctx,
            observations: {
              ...ctx.observations,
              [act.reference]: { status: 'available', value: Number(act.expected) - 1 },
            },
          }),
        ).toEqual({ ok: true, value: false });
        expect(
          evaluateCampaignCondition(b.eligibility, d.references, {
            ...ctx,
            observations: {
              ...ctx.observations,
              [discovery.reference]: { status: 'available', value: false },
            },
          }),
        ).toEqual({ ok: true, value: false });
        const observations = { ...ctx.observations };
        delete observations[metric.id];
        expect(
          evaluateCampaignCondition(b.eligibility, d.references, { ...ctx, observations }),
        ).toEqual({ ok: false, diagnostics: [{ code: 'MISSING_CONTEXT', path: metric.id }] });
      },
    );
  }
  it('queries a genuine no-sample record without mutating or blocking ordinary actions', () => {
    const f = authoredMidFixture();
    const run = f.start('INC-009'),
      before = canonicalJson(run);
    const q = getCampaignBranches(f.definition, f.catalog, run);
    expect(q.ok).toBe(true);
    if (!q.ok) throw new Error('Rejected branch query');
    expect(q.branches).toHaveLength(5);
    expect(q.branches.every((b) => !b.result.ok)).toBe(true);
    expect(canonicalJson(run)).toBe(before);
    expect(f.command(run, 'SHED_NONCRITICAL_LOAD').revision).toBeGreaterThan(run.revision);
  });
  it('allows overlapping reporting/investigation indicators from actual history without granting an effect or ending', () => {
    const f = authoredMidFixture();
    let run = f.acknowledge(f.prepare(f.investigate('INC-011'), 'GENERATOR_OWNERSHIP_REPORT'));
    run = f.command(run, 'SEND_GENERATOR_OWNERSHIP_REPORT');
    const before = canonicalJson(run),
      q = getCampaignBranches(f.definition, f.catalog, run);
    if (!q.ok) throw new Error('Rejected verified query');
    for (const id of ['COMPANY_REPORTING_ACCESS', 'INVESTIGATION_ACCESS'])
      expect(q.branches.find((b) => b.id === id)?.result).toEqual({ ok: true, value: true });
    expect(canonicalJson(run)).toBe(before);
    expect(run.projection.endingFlags).toEqual({});
    expect(run.projection.values).toEqual(f.definition.initial.values);
    expect(run.projection.alignment).toEqual(f.definition.initial.alignment);
  });
});
