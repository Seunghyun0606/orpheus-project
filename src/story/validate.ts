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
      for (const option of scene.options) checkCondition(option.when, `${scene.id}.${option.id}`);
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

// The distinct states each episode can be entered with when the episodes are
// played in campaign order. Conditions only read flags, so carries are
// distinct by flags; the first carry seen for a flag set stands for it.
export function campaignCarries(episodes: readonly Episode[]): Map<string, CampaignCarry[]> {
  const carries = new Map<string, CampaignCarry[]>();
  let entering: CampaignCarry[] = [emptyCarry];
  for (const episode of [...episodes].sort((a, b) => a.id.localeCompare(b.id))) {
    carries.set(episode.id, entering);
    const next = new Map<string, CampaignCarry>();
    for (const carry of entering)
      for (const { state } of enumeratePaths(episode, carry).paths) {
        const key = JSON.stringify(Object.entries(state.flags).sort());
        if (!next.has(key)) next.set(key, episodeCarry(state));
      }
    entering = [...next.values()];
  }
  return carries;
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
