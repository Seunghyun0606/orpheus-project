import {
  applyStoryInput,
  availableOptions,
  currentScene,
  emptyCarry,
  episodeCarry,
  startEpisode,
  type CampaignCarry,
  type EpisodeState,
  type StoryInput,
} from './runner.ts';
import { END, type Beat, type Condition, type Episode, type Scene } from './schema.ts';

// Episode checks beyond the schema (DEC-072): references resolve, the scene
// graph has no cycles, and — by playing every path — no path dead-ends, every
// deduction's solution is on the board when it is asked, and guaranteed
// evidence reaches every player.

export interface EpisodePath {
  readonly inputs: readonly StoryInput[];
  readonly state: EpisodeState;
}

function* beatsOf(scene: Scene): Generator<{ beat: Beat; where: string }> {
  for (const beat of scene.beats ?? []) yield { beat, where: scene.id };
  if (scene.type === 'choice') {
    for (const beat of scene.timer?.beats ?? []) yield { beat, where: `${scene.id} timer` };
    for (const option of scene.options)
      for (const beat of option.beats ?? []) yield { beat, where: `${scene.id}.${option.id}` };
  }
  if (scene.type === 'deduction')
    for (const [part, beats] of [
      ['hint', scene.hint],
      ['solved', scene.solved.beats],
      ['missed', scene.missed.beats],
    ] as const)
      for (const beat of beats ?? []) yield { beat, where: `${scene.id} ${part}` };
}

// Every player-facing string of an episode (for keyword checks).
export function episodeTexts(episode: Episode): string[] {
  const out: string[] = [episode.title];
  for (const item of episode.evidence) out.push(item.title, item.body);
  for (const scene of episode.scenes) {
    if (scene.title) out.push(scene.title);
    if (scene.type !== 'briefing') out.push(scene.prompt);
    for (const { beat } of beatsOf(scene)) {
      if ('narrate' in beat) out.push(beat.narrate);
      else if ('text' in beat) out.push(beat.text);
      else if ('log' in beat) out.push(beat.log);
      else if ('metric' in beat) out.push(beat.metric.label, beat.metric.value);
    }
    if (scene.type === 'choice')
      for (const option of scene.options) out.push(option.text, option.consequence ?? '');
  }
  return out;
}

function targetsOf(scene: Scene): string[] {
  if (scene.type !== 'choice') return [scene.next];
  return scene.options.map((option) => option.next ?? scene.next ?? '');
}

export function checkReferences(episode: Episode): string[] {
  const problems: string[] = [];
  const duplicates = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${kind} "${id}".`);
      seen.add(id);
    }
  };
  duplicates(
    'scene',
    episode.scenes.map((s) => s.id),
  );
  duplicates(
    'evidence',
    episode.evidence.map((e) => e.id),
  );
  duplicates(
    'cast member',
    episode.cast.map((c) => c.id),
  );

  const scenes = new Map(episode.scenes.map((s) => [s.id, s]));
  const evidence = new Set(episode.evidence.map((e) => e.id));
  const cast = new Set(episode.cast.map((c) => c.id));
  if (!scenes.has(episode.start)) problems.push(`Start scene "${episode.start}" does not exist.`);
  const allText = episodeTexts(episode).join('\n');
  for (const keyword of episode.keywords ?? [])
    if (!allText.includes(keyword))
      problems.push(`Keyword "${keyword}" does not appear in the episode.`);

  const checkCondition = (condition: Condition | undefined, where: string) => {
    for (const ref of [...(condition?.chose ?? []), ...(condition?.notChose ?? [])]) {
      const [sceneId, optionId] = ref.split('.');
      const scene = scenes.get(sceneId!);
      if (scene?.type !== 'choice' || !scene.options.some((o) => o.id === optionId))
        problems.push(`${where}: condition refers to unknown choice "${ref}".`);
    }
    for (const id of [...(condition?.has ?? []), ...(condition?.lacks ?? [])])
      if (!evidence.has(id))
        problems.push(`${where}: condition refers to unknown evidence "${id}".`);
  };

  for (const scene of episode.scenes) {
    for (const target of targetsOf(scene))
      if (target === '') problems.push(`${scene.id}: an option has no next scene.`);
      else if (target !== END && !scenes.has(target))
        problems.push(`${scene.id}: next scene "${target}" does not exist.`);
    for (const { beat, where } of beatsOf(scene)) {
      checkCondition(beat.when, where);
      if ('speaker' in beat && !cast.has(beat.speaker))
        problems.push(`${where}: speaker "${beat.speaker}" is not in the cast.`);
      if ('collect' in beat && !evidence.has(beat.collect))
        problems.push(`${where}: collects unknown evidence "${beat.collect}".`);
    }
    if (scene.type === 'choice') {
      duplicates(
        `option in ${scene.id}`,
        scene.options.map((o) => o.id),
      );
      for (const option of scene.options) {
        checkCondition(option.when, `${scene.id}.${option.id}`);
        if (
          option.when?.values !== undefined ||
          option.when?.alignment !== undefined ||
          option.when?.pressure !== undefined
        )
          problems.push(
            `${scene.id}.${option.id}: options are gated by choices and flags, not values.`,
          );
      }
      if (scene.timer !== undefined) {
        const fallback = scene.options.find((o) => o.id === scene.timer!.default);
        if (fallback === undefined)
          problems.push(`${scene.id}: timer default "${scene.timer.default}" is not an option.`);
        else if (fallback.when !== undefined)
          problems.push(`${scene.id}: timer default "${fallback.id}" must always be available.`);
      }
    }
    if (scene.type === 'deduction')
      for (const id of scene.solution)
        if (!evidence.has(id))
          problems.push(`${scene.id}: solution cites unknown evidence "${id}".`);
  }

  // Episodes are acyclic so every path ends.
  const state = new Map<string, 'open' | 'done'>();
  const visit = (sceneId: string, trail: string[]) => {
    if (sceneId === END || !scenes.has(sceneId) || state.get(sceneId) === 'done') return;
    if (state.get(sceneId) === 'open') {
      problems.push(`Scene cycle: ${[...trail, sceneId].join(' → ')}.`);
      return;
    }
    state.set(sceneId, 'open');
    for (const target of targetsOf(scenes.get(sceneId)!)) visit(target, [...trail, sceneId]);
    state.set(sceneId, 'done');
  };
  visit(episode.start, []);
  return problems;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  );
}

// Every way through the episode. Deductions are played as solved first time,
// solved after misses and missed; a miss uses the first wrong combination.
export function enumeratePaths(
  episode: Episode,
  carry: CampaignCarry = emptyCarry,
  limit = 50_000,
): { paths: EpisodePath[]; problems: string[] } {
  const paths: EpisodePath[] = [];
  const problems = new Set<string>();
  const walk = (state: EpisodeState, inputs: StoryInput[]) => {
    if (paths.length >= limit) {
      problems.add(`More than ${limit} paths; split the episode.`);
      return;
    }
    const scene = currentScene(episode, state);
    if (scene === undefined) {
      paths.push({ inputs, state });
      return;
    }
    const step = (input: StoryInput, from: EpisodeState = state, before = inputs) =>
      walk(applyStoryInput(episode, from, input), [...before, input]);
    switch (scene.type) {
      case 'briefing':
        step({ type: 'continue' });
        break;
      case 'choice': {
        const options = availableOptions(scene, state);
        if (options.length === 0) problems.add(`${scene.id}: no option is available on some path.`);
        for (const option of options) step({ type: 'choose', optionId: option.id });
        if (scene.timer !== undefined) step({ type: 'timeout' });
        break;
      }
      case 'deduction': {
        const missing = scene.solution.filter((id) => !state.collected.includes(id));
        if (missing.length > 0) {
          problems.add(
            `${scene.id}: solution evidence ${missing.join(', ')} is not collected on some path.`,
          );
          return;
        }
        const solution = { type: 'deduce', picks: scene.solution } as const;
        const wrong = combinations(state.collected, scene.solution.length).find(
          (picks) => !scene.solution.every((id) => picks.includes(id)),
        );
        step(solution);
        if (wrong === undefined) {
          problems.add(`${scene.id}: the board offers no wrong answer on some path.`);
          return;
        }
        let missedState = state;
        let missedInputs = inputs;
        for (let attempt = 1; attempt <= scene.attempts; attempt++) {
          const miss = { type: 'deduce', picks: wrong } as const;
          const next = applyStoryInput(episode, missedState, miss);
          missedInputs = [...missedInputs, miss];
          missedState = next;
          if (attempt < scene.attempts) step(solution, missedState, missedInputs);
        }
        walk(missedState, missedInputs);
        break;
      }
    }
  };
  walk(startEpisode(episode, carry), []);
  return { paths, problems: [...problems] };
}

// Every flag an episode's conditions read.
export function flagsRead(episode: Episode): Set<string> {
  const flags = new Set<string>();
  const read = (condition: Condition | undefined) =>
    Object.keys(condition?.flags ?? {}).forEach((flag) => flags.add(flag));
  for (const scene of episode.scenes) {
    for (const { beat } of beatsOf(scene)) read(beat.when);
    if (scene.type === 'choice') scene.options.forEach((option) => read(option.when));
  }
  return flags;
}

const flagKey = (flags: Readonly<Record<string, boolean>>, keep: ReadonlySet<string>) =>
  [...keep]
    .sort()
    .map((flag) => (flags[flag] ? '1' : '0'))
    .join('');

// Keeps at most `limit` carries while every reachable pair of values of any two
// watched flags stays represented (greedy pairwise cover), so options gated on
// one or two flags remain reachable for the validator.
function coverPairs(
  carries: CampaignCarry[],
  watched: readonly string[],
  limit: number,
): CampaignCarry[] {
  if (carries.length <= limit) return carries;
  const pairs = (carry: CampaignCarry) => {
    const set = new Set<string>();
    for (let i = 0; i < watched.length; i++)
      for (let j = i + 1; j < watched.length; j++)
        set.add(
          `${i}:${carry.flags[watched[i]!] ? 1 : 0}|${j}:${carry.flags[watched[j]!] ? 1 : 0}`,
        );
    return set;
  };
  const candidates = carries.map((carry) => ({ carry, pairs: pairs(carry) }));
  const uncovered = new Set(candidates.flatMap((c) => [...c.pairs]));
  const kept: CampaignCarry[] = [];
  while (uncovered.size > 0 && kept.length < limit) {
    let best = candidates[0]!;
    let gain = -1;
    for (const candidate of candidates) {
      let count = 0;
      for (const pair of candidate.pairs) if (uncovered.has(pair)) count++;
      if (count > gain) [best, gain] = [candidate, count];
    }
    kept.push(best.carry);
    best.pairs.forEach((pair) => uncovered.delete(pair));
    candidates.splice(candidates.indexOf(best), 1);
  }
  for (const { carry } of candidates) if (kept.length < limit) kept.push(carry);
  return kept;
}

// The distinct states each episode can be entered with when the episodes are
// played in campaign order. Conditions read flags (options) and accumulated
// values (beats only), so carries are distinct by the flags any later episode
// reads; past `limit` the set is reduced to a pairwise cover of those flags.
export function campaignCarries(
  episodes: readonly Episode[],
  limit = 48,
): Map<string, CampaignCarry[]> {
  const ordered = [...episodes].sort((a, b) => a.id.localeCompare(b.id));
  const reads = ordered.map(flagsRead);
  const carries = new Map<string, CampaignCarry[]>();
  let entering: CampaignCarry[] = [emptyCarry];
  ordered.forEach((episode, index) => {
    carries.set(episode.id, entering);
    const later = new Set(reads.slice(index + 1).flatMap((set) => [...set]));
    const next = new Map<string, CampaignCarry>();
    for (const carry of entering)
      for (const { state } of enumeratePaths(episode, carry).paths) {
        const key = flagKey(state.flags, later);
        if (!next.has(key)) next.set(key, episodeCarry(state));
      }
    entering = coverPairs([...next.values()], [...later].sort(), limit);
  });
  return carries;
}

// For checking one episode on its own: every combination of the flags it
// reads (up to 2^6), so authors need not have the earlier episodes ready.
export function soloCarries(episode: Episode): CampaignCarry[] {
  const flags = [...flagsRead(episode)].sort().slice(0, 6);
  return Array.from({ length: 2 ** flags.length }, (_, bits) => ({
    ...emptyCarry,
    flags: Object.fromEntries(flags.map((flag, i) => [flag, Boolean(bits & (1 << i))])),
  }));
}

// Checks an episode under every carry it can be entered with: options and
// evidence count as reachable when some carry reaches them.
export function validateEpisode(
  episode: Episode,
  carries: readonly CampaignCarry[] = [emptyCarry],
): string[] {
  const problems = checkReferences(episode);
  if (problems.length > 0) return problems;
  const paths: EpisodePath[] = [];
  for (const carry of carries) {
    const result = enumeratePaths(episode, carry);
    paths.push(...result.paths);
    problems.push(...result.problems);
  }

  const visited = new Set<string>();
  const chosen = new Set<string>();
  const collected = new Set<string>();
  for (const { inputs, state } of paths) {
    for (const entry of state.feed) {
      if (entry.kind === 'choice') {
        visited.add(entry.sceneId);
        chosen.add(`${entry.sceneId}.${entry.optionId}`);
      }
      if (entry.kind === 'deduction') visited.add(entry.sceneId);
    }
    state.collected.forEach((id) => collected.add(id));
    for (const item of episode.evidence)
      if (item.guaranteed && !state.collected.includes(item.id)) {
        problems.push(
          `Guaranteed evidence ${item.id} is missed by the path ${inputs.map(describe).join(' / ')}.`,
        );
        break;
      }
  }
  for (const scene of episode.scenes) {
    if (scene.type === 'choice') {
      for (const option of scene.options)
        if (!chosen.has(`${scene.id}.${option.id}`))
          problems.push(`${scene.id}.${option.id} is never available.`);
    } else if (scene.type === 'deduction' && !visited.has(scene.id))
      problems.push(`Deduction ${scene.id} is never reached.`);
  }
  for (const item of episode.evidence)
    if (!collected.has(item.id)) problems.push(`Evidence ${item.id} is never collected.`);
  const reachable = reachableScenes(episode);
  for (const scene of episode.scenes)
    if (!reachable.has(scene.id)) problems.push(`Scene ${scene.id} is unreachable.`);
  return [...new Set(problems)];
}

function reachableScenes(episode: Episode): Set<string> {
  const scenes = new Map(episode.scenes.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const queue = [episode.start];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (id === END || seen.has(id) || !scenes.has(id)) continue;
    seen.add(id);
    queue.push(...targetsOf(scenes.get(id)!));
  }
  return seen;
}

export function describe(input: StoryInput): string {
  switch (input.type) {
    case 'continue':
      return '…';
    case 'choose':
      return input.optionId;
    case 'timeout':
      return '⏱';
    case 'deduce':
      return `[${input.picks.join('+')}]`;
  }
}
