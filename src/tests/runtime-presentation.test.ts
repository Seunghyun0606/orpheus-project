import { describe, expect, it } from 'vitest';
import { runtimePresentationFixture } from './fixtures/runtime-presentation.ts';
import { startFixture, commandFixture } from './fixtures/opportunities.ts';
import { projectCampaignInvestigation } from '../engine/campaign/investigation.ts';
import { getFreshRuntimeNarratives } from '../engine/campaign/runtime-delivery.ts';
import {
  investigationPresentationSchema,
  narrativeDeliverySchema,
  validateInvestigationPresentation,
} from '../scenario/presentation.ts';

describe('verified schema-2 runtime projection (isolated)', () => {
  it('strictly rejects v1 streams, invalid delivery policies and incomplete coverage', () => {
    const f = runtimePresentationFixture();
    expect(investigationPresentationSchema.safeParse(f.presentation).success).toBe(true);
    expect(
      investigationPresentationSchema.safeParse({ ...f.presentation, schemaVersion: 1 }).success,
    ).toBe(false);
    const base = { reducedMotionMode: 'until_dismissed', historyMode: 'recorded' };
    for (const bad of [
      { ...base, mode: 'transient' },
      { ...base, mode: 'transient', durationMs: 0 },
      { ...base, mode: 'transient', durationMs: 60001 },
      { ...base, mode: 'transient', durationMs: 1.5 },
      { ...base, mode: 'until_dismissed', durationMs: 800 },
      { ...base, mode: 'until_dismissed', extra: true },
    ])
      expect(narrativeDeliverySchema.safeParse(bad).success).toBe(false);
    for (const kind of ['narrative_stream', 'war_room_stream']) {
      const p = structuredClone(f.presentation);
      for (const panel of p.panels) panel.blocks = panel.blocks.filter((b) => b.kind !== kind);
      expect(validateInvestigationPresentation(p, f.scenario, f.definition).length).toBeGreaterThan(
        0,
      );
    }
    const wrong = structuredClone(f.presentation);
    wrong.panels[0]!.kind = 'documents';
    expect(validateInvestigationPresentation(wrong, f.scenario, f.definition)).toContain(
      'INVALID_NARRATIVE_STREAM_PANEL',
    );
    const duplicate = structuredClone(f.presentation);
    const stream = duplicate.panels[0]!.blocks.find((b) => b.kind === 'narrative_stream')!;
    if (stream.kind === 'narrative_stream') stream.entries.push(stream.entries[0]!);
    expect(validateInvestigationPresentation(duplicate, f.scenario, f.definition)).toContain(
      'INVALID_STREAM_NARRATIVE_COVERAGE',
    );
  });
  it('does not expose Good before trigger; exact owned command yields one fresh message and permanent read-only history', () => {
    const f = runtimePresentationFixture();
    let run = startFixture(f.definition);
    const before = projectCampaignInvestigation(f.composition, run, 'attempt');
    expect(JSON.stringify(before)).not.toContain('UNKNOWN: Good.');
    for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS'])
      run = commandFixture(f.definition, run, id);
    const prior = run;
    run = commandFixture(f.definition, run, 'TERMINATE_STALE_SESSIONS');
    const a = run.attempts[0]!;
    const update = {
      operation: run.operations.at(-1)!,
      events: a.incident.eventLog.slice(prior.attempts[0]!.incident.eventLog.length),
    };
    const saved = JSON.stringify(run);
    const fresh = getFreshRuntimeNarratives(f.composition, run, update, prior.revision);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.body).toContain('UNKNOWN: Good.');
    expect(getFreshRuntimeNarratives(f.composition, run, update, run.revision)).toEqual([]);
    expect(getFreshRuntimeNarratives(f.composition, run, { ...update, events: [] }, -1)).toEqual(
      [],
    );
    expect(
      getFreshRuntimeNarratives(
        f.composition,
        run,
        { ...update, events: [...update.events, ...update.events] },
        -1,
      ),
    ).toEqual([]);
    expect(
      getFreshRuntimeNarratives(
        f.composition,
        run,
        { ...update, operation: { ...update.operation, operationId: 'foreign' } },
        -1,
      ),
    ).toEqual([]);
    expect(JSON.stringify(projectCampaignInvestigation(f.composition, run, 'attempt'))).toContain(
      'UNKNOWN: Good.',
    );
    const damaged = structuredClone(run);
    damaged.attempts[0]!.incident.elapsedSeconds++;
    expect(projectCampaignInvestigation(f.composition, damaged, 'attempt').ok).toBe(false);
    expect(JSON.stringify(run)).toBe(saved);
  });
  it('projects authored initial messages, Jin ACK at 0, due ETA and report at 120 with released capacity', () => {
    const f = runtimePresentationFixture();
    let run = startFixture(f.definition);
    const war = () => {
      const view = projectCampaignInvestigation(f.composition, run, 'attempt');
      if (!view.ok) throw new Error(JSON.stringify(view));
      const block = view.panels.flatMap((p) => p.blocks).find((b) => b.kind === 'war_room_stream');
      if (!block || block.kind !== 'war_room_stream') throw new Error('missing war');
      return block;
    };
    expect(war().messages).toHaveLength(2);
    run = commandFixture(f.definition, run, 'ASK_JIN_CONFIRM_IMPACT');
    expect(war().messages.at(-1)?.atSeconds).toBe(0);
    expect(war().messages.at(-1)?.sender).toBe('Jin / Support');
    expect(war().pending[0]?.dueAtSeconds).toBe(120);
    expect(war().pending[0]?.remainingSeconds).toBe(100);
    expect(war().capacity[0]?.value).toBe(2);
    for (let i = 0; i < 3; i++) run = commandFixture(f.definition, run, 'OPEN_METRICS');
    expect(war().pending[0]?.remainingSeconds).toBe(10);
    expect(war().messages).toHaveLength(3);
    run = commandFixture(f.definition, run, 'OPEN_METRICS');
    expect(war().pending).toEqual([]);
    expect(war().messages.at(-1)?.atSeconds).toBe(120);
    expect(war().messages.at(-1)?.text).toContain('Failed checkouts are confirmed');
    expect(war().capacity[0]?.value).toBe(3);
  });
});
