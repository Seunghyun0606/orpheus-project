import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import {
  applyStoryInput,
  availableOptions,
  currentScene,
  emptyCarry,
  startEpisode,
  StoryInputError,
  type EpisodeState,
  type StoryInput,
} from './runner.ts';
import {
  parseEpisode,
  type Beat,
  type ChoiceScene,
  type DeductionScene,
  type Episode,
} from './schema.ts';
import { campaignCarries, enumeratePaths, validateEpisode } from './validate.ts';

const dataDir = 'src/story/data/';
const episodes = readdirSync(dataDir)
  .filter((file) => file.endsWith('.yaml'))
  .map((file) => parseEpisode(readFileSync(dataDir + file, 'utf8')));
const inc001 = episodes.find((episode) => episode.id === 'INC-001')!;
// Computed once: walking the whole campaign is the expensive part.
const carriesByEpisode = campaignCarries(episodes);

function play(episode: Episode, inputs: readonly StoryInput[]): EpisodeState {
  return inputs.reduce(
    (state, input) => applyStoryInput(episode, state, input),
    startEpisode(episode),
  );
}

const go = { type: 'continue' } as const;
const choose = (optionId: string) => ({ type: 'choose', optionId }) as const;
const deduce = (...picks: string[]) => ({ type: 'deduce', picks }) as const;

// Rewrites one episode through plain data so each test breaks it on purpose.
function mutate(change: (raw: Episode) => void): Episode {
  const raw = parse(readFileSync(dataDir + 'inc-001.yaml', 'utf8')) as Episode;
  change(raw);
  return parseEpisode(stringify(raw));
}

describe('story episodes', () => {
  it.each(episodes.map((e) => [e.id, e]))('%s has no dead ends', (_, episode) => {
    const carries = carriesByEpisode.get(episode.id)!;
    expect(validateEpisode(episode, carries)).toEqual([]);
    for (const carry of carries)
      for (const { state } of enumeratePaths(episode, carry).paths)
        expect(state.sceneId).toBeNull();
  });
});

describe('INC-001 episode', () => {
  it('collects evidence without the player asking', () => {
    const state = startEpisode(inc001);
    expect(state.sceneId).toBe('page');
    expect(state.collected).toEqual(['ERROR_SPIKE', 'POOL_AT_LIMIT']);
    expect(state.feed.slice(0, 2)).toMatchObject([
      { kind: 'scene', sceneId: 'page' },
      { kind: 'narrate' },
    ]);
  });

  it('reaches the cause from every first look', () => {
    for (const option of ['SESSIONS', 'DEPLOY', 'CUSTOMERS']) {
      const state = play(inc001, [go, choose(option)]);
      expect(state.sceneId).toBe('why');
      expect(state.collected).toContain('IDLE_TRANSACTIONS');
    }
  });

  it('plays the reference path and carries its choices', () => {
    const state = play(inc001, [
      go,
      choose('SESSIONS'),
      deduce('IDLE_TRANSACTIONS', 'POOL_AT_LIMIT'),
      choose('TERMINATE'),
      go,
      choose('MAYA'),
    ]);
    expect(state.sceneId).toBeNull();
    expect(state.collected).toContain('CORRUPTED_LOG_ENTRY');
    expect(state.solved).toEqual({ why: true });
    expect(state.flags).toEqual({ ROOT_CAUSE_RESOLVED: true, UNKNOWN_SHARED_WITH_MAYA: true });
    expect(state.alignment).toEqual({ corporate: 1, null: 0 });
    expect(state.values).toMatchObject({
      operationalSafety: 2,
      curiosity: 2,
      evidence: 1,
      teamTrust: 1,
    });
  });

  it('lets a deduction miss once with a hint, then moves on with a cost', () => {
    const before = play(inc001, [go, choose('SESSIONS')]);
    const once = applyStoryInput(inc001, before, deduce('ERROR_SPIKE', 'POOL_AT_LIMIT'));
    expect(once.sceneId).toBe('why');
    expect(once.feed.at(-1)).toMatchObject({ kind: 'line', speaker: 'MAYA' });
    const twice = applyStoryInput(inc001, once, deduce('ERROR_SPIKE', 'IDLE_TRANSACTIONS'));
    expect(twice.sceneId).toBe('decide');
    expect(twice.solved).toEqual({ why: false });
    expect(twice.pressure).toBe(1);
  });

  it('applies the authored default when the decision timer runs out', () => {
    const state = play(inc001, [
      go,
      choose('SESSIONS'),
      deduce('POOL_AT_LIMIT', 'IDLE_TRANSACTIONS'),
    ]);
    const late = applyStoryInput(inc001, state, { type: 'timeout' });
    expect(late.choices.decide).toBe('RESTART');
    expect(late.timedOut).toEqual(['decide']);
    expect(late.feed).toContainEqual({
      kind: 'choice',
      sceneId: 'decide',
      optionId: 'RESTART',
      timedOut: true,
    });
  });

  it('only offers a rollback to someone who looked at the deploy', () => {
    const decide = inc001.scenes.find((s) => s.id === 'decide') as ChoiceScene;
    const ids = (first: string) =>
      availableOptions(
        decide,
        play(inc001, [go, choose(first), deduce('POOL_AT_LIMIT', 'IDLE_TRANSACTIONS')]),
      ).map((o) => o.id);
    expect(ids('SESSIONS')).not.toContain('ROLLBACK');
    expect(ids('DEPLOY')).toContain('ROLLBACK');
  });

  it('rejects inputs the scene does not take', () => {
    const state = startEpisode(inc001);
    expect(() => applyStoryInput(inc001, state, choose('SESSIONS'))).toThrow(StoryInputError);
    const atChoice = applyStoryInput(inc001, state, go);
    expect(() => applyStoryInput(inc001, atChoice, { type: 'timeout' })).toThrow(/no timer/);
    expect(() => applyStoryInput(inc001, atChoice, choose('NOPE'))).toThrow(/not available/);
    const atWhy = applyStoryInput(inc001, atChoice, choose('SESSIONS'));
    expect(() => applyStoryInput(inc001, atWhy, deduce('CLEAN_DEPLOY', 'POOL_AT_LIMIT'))).toThrow(
      /at most once/,
    );
    expect(() => applyStoryInput(inc001, atWhy, deduce('POOL_AT_LIMIT'))).toThrow(/exactly 2/);
    expect(currentScene(inc001, atWhy)?.type).toBe('deduction');
  });

  it('is deterministic', () => {
    const inputs = [go, choose('CUSTOMERS'), deduce('ERROR_SPIKE', 'CLIENT_RETRIES')];
    expect(play(inc001, inputs)).toEqual(play(inc001, inputs));
  });
});

describe('Act 1 as a campaign', () => {
  const byId = (id: string) => episodes.find((e) => e.id === id)!;
  const carryWith = (flags: Record<string, boolean>) => ({ ...emptyCarry, flags });
  const lines = (state: EpisodeState) =>
    state.feed.flatMap((e) => (e.kind === 'line' || e.kind === 'narrate' ? [e.text] : []));

  it('opens INC-002 with what the player did with the first UNKNOWN line', () => {
    const inc002 = byId('INC-002');
    const opening = (flag: string) => lines(startEpisode(inc002, carryWith({ [flag]: true })));
    expect(opening('UNKNOWN_SHARED_WITH_MAYA').join(' ')).toMatch(/grepped every test harness/);
    expect(opening('UNKNOWN_REPORTED').join(' ')).toMatch(/No owner found/);
    expect(opening('UNKNOWN_KEPT').join(' ')).toMatch(/text file on your desktop/);
  });

  it('lets only a player who confided in Maya bring her the third message', () => {
    const inc003 = byId('INC-003');
    const report = inc003.scenes.find((s) => s.id === 'report') as ChoiceScene;
    const reach = (flags: Record<string, boolean>) =>
      availableOptions(
        report,
        [go, choose('LOGS'), go, choose('QUARANTINE'), go].reduce(
          (state, input) => applyStoryInput(inc003, state, input),
          startEpisode(inc003, carryWith(flags)),
        ),
      ).map((o) => o.id);
    expect(reach({})).toEqual(['TICKET', 'KEEP']);
    expect(reach({ UNKNOWN_SHARED_WITH_MAYA: true })).toEqual(['TICKET', 'KEEP', 'MAYA']);
  });

  it('hands an unanswered INC-003 decision to automation', () => {
    const inc003 = byId('INC-003');
    const state = play(inc003, [go, choose('LOGS'), go, { type: 'timeout' }]);
    expect(state.choices.decide).toBe('DROP');
    expect(state.feed).toContainEqual(
      expect.objectContaining({ kind: 'line', speaker: 'PLATFORM' }),
    );
  });

  it('reaches every Act 1 episode from every earlier ending', () => {
    const carries = carriesByEpisode;
    expect(carries.get('INC-001')).toHaveLength(1);
    expect(carries.get('INC-002')!.length).toBe(3);
    expect(carries.get('INC-003')!.length).toBeGreaterThan(3);
  });
});

describe('episode validator', () => {
  // Any scene's fields, for breaking them in place.
  type LooseScene = Partial<
    Omit<ChoiceScene, 'type' | 'next'> & Omit<DeductionScene, 'type' | 'next'>
  > & {
    next?: string;
  };
  const problems = (change: (raw: Episode) => void) => validateEpisode(mutate(change));
  const scene = (raw: Episode, id: string) => raw.scenes.find((s) => s.id === id) as LooseScene;
  const collects = (id: string) => (b: Beat) => 'collect' in b && b.collect === id;

  it('rejects dangling references and cycles', () => {
    expect(problems((raw) => (scene(raw, 'page').next = 'nowhere'))).toContain(
      'page: next scene "nowhere" does not exist.',
    );
    expect(
      problems((raw) => scene(raw, 'page').beats!.push({ speaker: 'NULL', text: 'hi' })),
    ).toContain('page: speaker "NULL" is not in the cast.');
    expect(problems((raw) => (scene(raw, 'report').next = 'page'))[0]).toMatch(
      /^Scene cycle: page → /,
    );
  });

  it('rejects a deduction whose answer some path never collects', () => {
    const result = problems((raw) => {
      const deploy = scene(raw, 'approach').options!.find((o) => o.id === 'DEPLOY')!;
      deploy.beats = deploy.beats!.filter((b) => !collects('IDLE_TRANSACTIONS')(b));
    });
    expect(result).toContain(
      'why: solution evidence IDLE_TRANSACTIONS is not collected on some path.',
    );
  });

  it('rejects a timer default that is not always available', () => {
    expect(problems((raw) => (scene(raw, 'decide').timer!.default = 'ROLLBACK'))).toContain(
      'decide: timer default "ROLLBACK" must always be available.',
    );
  });

  it('rejects guaranteed evidence that a path can miss', () => {
    const result = problems((raw) => {
      scene(raw, 'buffer').beats!.find(collects('CORRUPTED_LOG_ENTRY'))!.when = {
        chose: ['decide.TERMINATE'],
      };
    });
    expect(
      result.some((p) => p.startsWith('Guaranteed evidence CORRUPTED_LOG_ENTRY is missed')),
    ).toBe(true);
  });

  it('rejects options and evidence nobody can reach', () => {
    expect(
      problems(
        (raw) =>
          (scene(raw, 'decide').options![3]!.when = { has: ['CLIENT_RETRIES', 'CLEAN_DEPLOY'] }),
      ),
    ).toContain('decide.ROLLBACK is never available.');
  });
});
