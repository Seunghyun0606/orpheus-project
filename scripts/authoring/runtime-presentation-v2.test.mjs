// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { authorRuntimePresentationV2 } from './runtime-presentation-v2.mjs';
import { sourceInventory } from '../task034-support.mjs';
import { inspectProductionCampaignSources } from '../../src/scenario/production-catalog.ts';
import { fixtureOperation } from '../../src/tests/fixtures/opportunities.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
} from '../../src/engine/campaign/transitions.ts';
import { projectCampaignInvestigation } from '../../src/engine/campaign/investigation.ts';
import { getFreshRuntimeNarratives } from '../../src/engine/campaign/runtime-delivery.ts';

const read = (file) => parse(readFileSync(file, 'utf8'));
describe('approved additive production runtime authorities', () => {
  let registry;
  beforeAll(() => {
    const result = inspectProductionCampaignSources(
      sourceInventory(),
      read('src/scenario/data/full-campaign-manifest.yaml'),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    registry = result.registry;
  });
  it('preserves all 60 protected old byte hashes and authoring is exactly the permitted transformation', () => {
    const baseline = JSON.parse(
      readFileSync('.project-os/planning/TASK-035.protected-content-baseline.json', 'utf8'),
    );
    expect(baseline.files).toHaveLength(60);
    for (const entry of baseline.files) {
      const bytes = readFileSync(entry.path);
      expect(bytes.length).toBe(entry.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
    const generated = authorRuntimePresentationV2(read);
    expect(Object.keys(generated)).toHaveLength(29);
    for (const [file, value] of Object.entries(generated)) expect(read(file)).toEqual(value);
    const root = 'src/scenario/data/full-campaign/';
    const old = read(root + 'definitions/campaign.yaml'),
      next = read(root + 'definitions/campaign-1.1.0.yaml');
    expect(next.references).toHaveLength(111);
    expect(next.branches).toHaveLength(5);
    next.version = old.version;
    next.references.forEach((r, i) => {
      r.version = old.references[i].version;
    });
    next.branches.forEach((b, i) => {
      b.version = old.branches[i].version;
    });
    expect(next).toEqual(old);
  });
  it('resolves explicit old/new packages with original/new views, never latest or missing version', () => {
    const old = registry.resolve('orpheus-full-campaign', '1.0.0'),
      next = registry.resolve('orpheus-full-campaign', '1.1.0');
    expect(old.presentations).toHaveLength(26);
    expect(next.presentations).toHaveLength(26);
    expect(old.presentations.every((p) => p.schemaVersion === 1 && p.version === '1.0.0')).toBe(
      true,
    );
    expect(next.presentations.every((p) => p.schemaVersion === 2 && p.version === '1.1.0')).toBe(
      true,
    );
    expect(registry.resolve('orpheus-full-campaign', 'latest')).toBeUndefined();
    expect(registry.resolve('orpheus-full-campaign', '1.1.1')).toBeUndefined();
    const narratives = next.presentations
      .flatMap((v) => v.panels.flatMap((p) => p.blocks))
      .filter((b) => b.kind === 'narrative_stream')
      .flatMap((b) => b.entries);
    expect(narratives.filter((n) => n.delivery.mode === 'transient')).toEqual([
      {
        narrativeId: 'UNKNOWN_GOOD',
        delivery: {
          mode: 'transient',
          durationMs: 800,
          reducedMotionMode: 'until_dismissed',
          historyMode: 'recorded',
        },
      },
    ]);
    const final = next.presentations.find((v) => v.scenarioId === 'INC-026');
    expect(final.panels).toHaveLength(35);
    for (const p of final.panels.slice(-2)) expect(p.actionIds).toEqual([]);
    expect(next.endingPresentation.definitionVersion).toBe('1.1.0');
  });
  describe('genuine 1.1.0 production INC-001 commands', () => {
    let p, run;
    const apply = (payload) => {
      const result = prepareCampaignOperation(
        p.definition,
        p.catalog,
        run,
        fixtureOperation(p.definition, run, payload),
      );
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      run = result.run;
    };
    const command = (actionId) => {
      const a = run.attempts[0];
      apply({
        kind: 'command',
        attemptId: a.id,
        inputId: 'input-' + run.revision,
        commandSequence: a.incident.replayLog.length,
        priorHead: campaignAttemptHead(a),
        command: { type: 'perform_action', actionId },
      });
    };
    it('creates and starts the real exact new package, no forged scores or translated history', () => {
      p = registry.resolve('orpheus-full-campaign', '1.1.0');
      run = null;
      apply({ kind: 'create' });
      apply({ kind: 'start', incidentId: 'INC-001', attemptId: 'real-first', seed: 1002 });
      const view = projectCampaignInvestigation(p, run, 'real-first');
      expect(view.ok).toBe(true);
      expect(JSON.stringify(view)).not.toContain('UNKNOWN: Good.');
      expect(view.panels.find((panel) => panel.id === 'team').blocks[0].messages).toHaveLength(2);
    });
    for (const [i, id] of [
      'ASK_JIN_CONFIRM_IMPACT',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ].entries()) {
      it('accepts production command ' + i + ' ' + id + ' at unchanged timeout', () => {
        const prior = run;
        command(id);
        const view = projectCampaignInvestigation(p, run, 'real-first');
        expect(view.ok).toBe(true);
        const war = view.panels
          .find((panel) => panel.id === 'team')
          .blocks.find((b) => b.kind === 'war_room_stream');
        if (i === 0) {
          expect(war.messages.at(-1).atSeconds).toBe(0);
          expect(war.pending[0].dueAtSeconds).toBe(120);
          expect(war.pending[0].remainingSeconds).toBe(100);
        }
        if (i === 3) expect(war.pending[0].remainingSeconds).toBe(10);
        if (i === 4) {
          expect(war.pending).toEqual([]);
          expect(war.messages.at(-1).atSeconds).toBe(120);
        }
        if (id !== 'TERMINATE_STALE_SESSIONS')
          expect(JSON.stringify(view)).not.toContain('UNKNOWN: Good.');
        else {
          const update = {
            operation: run.operations.at(-1),
            events: run.attempts[0].incident.eventLog.slice(
              prior.attempts[0].incident.eventLog.length,
            ),
          };
          expect(
            getFreshRuntimeNarratives(p, run, update, prior.revision).map((n) => n.body),
          ).toEqual(['02:23:11 / UNKNOWN: Good.']);
          expect(JSON.stringify(projectCampaignInvestigation(p, run, 'real-first'))).toContain(
            'UNKNOWN: Good.',
          );
          expect(run.projection.completed).toEqual(['INC-001']);
        }
      });
    }
  });
});
