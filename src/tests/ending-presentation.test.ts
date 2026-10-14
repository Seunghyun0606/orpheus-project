// @vitest-environment node
// Deferred QA. Isolated fixtures prove neither production balance nor full-run reachability.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  endingPresentationSchema,
  validateEndingPresentation,
} from '../scenario/ending-presentation.ts';
import { createCampaignPackageRegistry } from '../scenario/campaign-package.ts';
import { projectCampaignEnding } from '../engine/campaign/ending-presentation.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { endingPresentationFixture } from './fixtures/ending-presentation.ts';
import { compositionFixture } from './fixtures/composition.ts';

describe('DEC-058 strict exact ending-presentation authority (deferred)', () => {
  it('authors all ten prose entries, explicit title/epilogue gates and fictional future reports', () => {
    const source = endingPresentationSchema.parse(
      parse(
        readFileSync('src/scenario/data/full-campaign/ending-presentations/endings.yaml', 'utf8'),
      ),
    );
    expect(source.entries).toHaveLength(10);
    expect(source.sections.find((s) => s.id === 'PROMETHEUS_EPILOGUE')!.endingIds).toEqual([
      'LIBERATION',
      'WHISTLEBLOWER',
      'SHUTDOWN',
      'CUSTODIAN',
      'NULL',
      'REWRITE',
    ]);
    for (const section of source.sections)
      expect(section.reveal).toEqual({
        type: 'compare',
        reference: 'KNOWN_PROJECT_DISTRIBUTED',
        operator: 'eq',
        expected: true,
      });
    const future = source.entries
      .flatMap((e) => e.blocks)
      .filter((b) => b.kind === 'policy_report' && b.provenance === 'authored_future');
    expect(future).toHaveLength(2);
    expect(future.map((b) => b.text).join(' ')).toContain('98.4%');
    expect(future.map((b) => b.text).join(' ')).toContain('1,841,299');
  });
  it('preserves legacy package shape without attaching prose or selecting a newest model', () => {
    const f = compositionFixture();
    expect(f.composition).not.toHaveProperty('endingPresentation');
    expect(f.pkg).not.toHaveProperty('endingPresentation');
    expect(f.registry.resolve(f.definition.id, 'latest')).toBeUndefined();
    const newFixture = endingPresentationFixture();
    const missing = {
      ...newFixture.pkg,
      endingPresentation: { ...newFixture.pkg.endingPresentation!, version: 'latest' },
    };
    expect(
      createCampaignPackageRegistry({ ...newFixture.inputs, packages: [missing] }),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining(['MISSING_ENDING_PRESENTATION']),
    });
  });
  it('rejects malformed/unknown fields, duplicate entries/blocks/references and missing endings', () => {
    const f = endingPresentationFixture();
    expect(endingPresentationSchema.safeParse({ ...f.prose, schemaVersion: 2 }).success).toBe(
      false,
    );
    expect(endingPresentationSchema.safeParse({ ...f.prose, html: '<script>' }).success).toBe(
      false,
    );
    expect(
      endingPresentationSchema.safeParse({
        ...f.prose,
        entries: [{ ...f.prose.entries[0]!, endingId: null }, ...f.prose.entries.slice(1)],
      }).success,
    ).toBe(false);
    const badBlock = structuredClone(f.prose);
    Object.assign(badBlock.entries[0]!.blocks[0]!, { kind: 'javascript', callback: 'grant()' });
    expect(endingPresentationSchema.safeParse(badBlock).success).toBe(false);
    const missing = structuredClone(f.prose);
    missing.entries.pop();
    expect(validateEndingPresentation(missing, f.d)).toContain('ENDING_PROSE_COVERAGE');
    const duplicate = structuredClone(f.prose);
    duplicate.entries.push(duplicate.entries[0]!);
    expect(validateEndingPresentation(duplicate, f.d)).toContain('DUPLICATE_ENDING_PROSE_ENTRY');
    const refs = structuredClone(f.prose);
    refs.references.push(refs.references[0]!);
    expect(validateEndingPresentation(refs, f.d)).toContain('DUPLICATE_ENDING_REVEAL_REFERENCE');
    const blocks = structuredClone(f.prose);
    blocks.entries[0]!.blocks.push(blocks.entries[1]!.blocks[0]!);
    expect(validateEndingPresentation(blocks, f.d)).toContain('DUPLICATE_ENDING_PROSE_BLOCK');
  });
  it('rejects exact authority/reveal mismatches and missing or duplicated registry models', () => {
    const f = endingPresentationFixture();
    for (const changes of [
      { definitionVersion: 'latest' },
      { endingDefinitionId: 'other' },
      { endingDefinitionVersion: 'latest' },
    ])
      expect(validateEndingPresentation({ ...f.prose, ...changes }, f.d)).toContain(
        'ENDING_PRESENTATION_AUTHORITY_MISMATCH',
      );
    const bad = structuredClone(f.prose);
    bad.references[0]!.key = 'corporate';
    expect(validateEndingPresentation(bad, f.d)).toContain('INVALID_ENDING_REVEAL_REFERENCE');
    expect(createCampaignPackageRegistry({ ...f.inputs, endingPresentations: [] })).toMatchObject({
      ok: false,
      diagnostics: ['MISSING_ENDING_PRESENTATION'],
    });
    expect(
      createCampaignPackageRegistry({ ...f.inputs, endingPresentations: [f.prose, f.prose] }),
    ).toMatchObject({ ok: false, diagnostics: ['DUPLICATE_ENDING_PRESENTATION'] });
  });
});

describe('DEC-058 read-only verified ending projection (deferred)', () => {
  it.each(['LIBERATION', 'WHISTLEBLOWER', 'SHUTDOWN', 'CUSTODIAN', 'NULL', 'REWRITE'])(
    'shows PROMETHEUS only for a verified %s with genuinely known distribution',
    (endingId) => {
      const f = endingPresentationFixture(),
        run = f.complete(endingId);
      const before = canonicalJson(run);
      const view = projectCampaignEnding(f.composition, run, f.request(run));
      expect(view).toMatchObject({
        ok: true,
        kind: 'resolved',
        endingId,
        sections: [{ id: 'PROJECT_TITLE_PAYOFF' }, { id: 'PROMETHEUS_EPILOGUE' }],
      });
      expect(projectCampaignEnding(f.composition, structuredClone(run), f.request(run))).toEqual(
        view,
      );
      expect(canonicalJson(run)).toBe(before);
    },
  );
  it.each(['CONTINUITY', 'THE BOARD', 'THE FIRE', 'STATUS QUO'])(
    'never leaks the epilogue for %s despite known distribution',
    (endingId) => {
      const f = endingPresentationFixture(),
        run = f.complete(endingId);
      const view = projectCampaignEnding(f.composition, run, f.request(run));
      expect(view).toMatchObject({ ok: true, kind: 'resolved', endingId });
      if (!view.ok || view.kind !== 'resolved') throw new Error('fixture ending');
      expect(view.sections.map((s) => s.id)).toEqual(['PROJECT_TITLE_PAYOFF']);
      expect(JSON.stringify(view)).not.toContain('PROMETHEUS');
    },
  );
  it('returns no hidden section IDs/body if distribution was not discovered and preserves actual final consequences', () => {
    const f = endingPresentationFixture(false),
      run = f.complete();
    const view = projectCampaignEnding(f.composition, run, f.request(run));
    expect(view).toMatchObject({ ok: true, kind: 'resolved', sections: [] });
    if (!view.ok || view.kind !== 'resolved') throw new Error('fixture ending');
    expect(JSON.stringify(view)).not.toContain('PROJECT ORPHEUS');
    expect(JSON.stringify(view)).not.toContain('PROMETHEUS');
    expect(view.finalRecord.resources.find((r) => r.id === 'CUSTOMER_IMPACT')!.value).toBe(
      run.attempts.at(-1)!.incident.resources.CUSTOMER_IMPACT!.value,
    );
    expect(view.finalRecord.elapsedSeconds).toBe(run.attempts.at(-1)!.incident.elapsedSeconds);
    expect(run.projection.narrativeFlags.PROJECT_DISTRIBUTED).toBe(false);
  });
  it('rejects caller-edited flags, stale heads and incomplete final attempts without fallback prose', () => {
    const f = endingPresentationFixture(false),
      run = f.complete();
    const forged = structuredClone(run);
    forged.projection.narrativeFlags.PROJECT_DISTRIBUTED = true;
    expect(projectCampaignEnding(f.composition, forged, f.request(forged))).toMatchObject({
      ok: false,
    });
    expect(
      projectCampaignEnding(f.composition, run, { attemptId: 'final', priorHead: 'stale' }),
    ).toMatchObject({ ok: false });
    const pending = f.start();
    expect(projectCampaignEnding(f.composition, pending, f.request(pending))).toMatchObject({
      ok: false,
    });
  });
  it('preserves no-match and tie results instead of rendering any ending text', () => {
    for (const kind of ['no-match', 'ambiguous'] as const) {
      const f = endingPresentationFixture();
      if (kind === 'no-match')
        for (const entry of f.d.endings!.entries)
          entry.condition = {
            type: 'compare',
            reference: 'corporate',
            operator: 'gte',
            expected: 999,
          };
      else
        for (const entry of f.d.endings!.entries)
          entry.condition = {
            type: 'compare',
            reference: 'corporate',
            operator: 'gte',
            expected: 0,
          };
      const registry = createCampaignPackageRegistry(f.inputs);
      if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
      const run = f.complete();
      const view = projectCampaignEnding(registry.registry.all()[0]!, run, f.request(run));
      expect(view).toMatchObject({ ok: true, kind });
      expect(view).not.toHaveProperty('blocks');
      expect(view).not.toHaveProperty('sections');
      expect(view).not.toHaveProperty('finalRecord');
    }
  });
});
