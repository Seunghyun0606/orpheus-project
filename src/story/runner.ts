import {
  END,
  storyAlignments,
  storyValues,
  type Beat,
  type ChoiceScene,
  type Condition,
  type DeductionScene,
  type Effects,
  type Episode,
  type Scene,
  type StoryAlignment,
  type StoryOption,
  type StoryValue,
} from './schema.ts';

// Reference runner for story episodes. Pure and deterministic: the same
// episode, campaign state and inputs give the same state. The Godot runtime
// must reproduce it (DEC-072), so keep it small and free of host APIs.

export interface CampaignCarry {
  readonly values: Readonly<Record<StoryValue, number>>;
  readonly alignment: Readonly<Record<StoryAlignment, number>>;
  readonly flags: Readonly<Record<string, boolean>>;
}

export type FeedEntry =
  | { readonly kind: 'scene'; readonly sceneId: string }
  | { readonly kind: 'narrate'; readonly text: string }
  | { readonly kind: 'line'; readonly speaker: string; readonly text: string }
  | { readonly kind: 'log'; readonly text: string }
  | {
      readonly kind: 'metric';
      readonly label: string;
      readonly value: string;
      readonly trend?: 'up' | 'down' | 'flat';
    }
  | { readonly kind: 'evidence'; readonly id: string }
  | {
      readonly kind: 'choice';
      readonly sceneId: string;
      readonly optionId: string;
      readonly timedOut: boolean;
    }
  | {
      readonly kind: 'deduction';
      readonly sceneId: string;
      readonly picks: readonly string[];
      readonly correct: boolean;
    };

export interface EpisodeState extends CampaignCarry {
  readonly episodeId: string;
  // null once the episode has ended.
  readonly sceneId: string | null;
  readonly attempts: number;
  readonly collected: readonly string[];
  readonly choices: Readonly<Record<string, string>>;
  readonly solved: Readonly<Record<string, boolean>>;
  readonly timedOut: readonly string[];
  readonly pressure: number;
  readonly feed: readonly FeedEntry[];
}

export type StoryInput =
  | { readonly type: 'continue' }
  | { readonly type: 'choose'; readonly optionId: string }
  | { readonly type: 'timeout' }
  | { readonly type: 'deduce'; readonly picks: readonly string[] };

export class StoryInputError extends Error {}

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

export const emptyCarry: CampaignCarry = {
  values: zeroes(storyValues),
  alignment: zeroes(storyAlignments),
  flags: {},
};

// Mutable working copy used while one input is applied.
interface Draft {
  episodeId: string;
  sceneId: string | null;
  attempts: number;
  collected: string[];
  choices: Record<string, string>;
  solved: Record<string, boolean>;
  timedOut: string[];
  pressure: number;
  feed: FeedEntry[];
  values: Record<StoryValue, number>;
  alignment: Record<StoryAlignment, number>;
  flags: Record<string, boolean>;
}

const draftOf = (state: EpisodeState): Draft => ({
  ...state,
  collected: [...state.collected],
  choices: { ...state.choices },
  solved: { ...state.solved },
  timedOut: [...state.timedOut],
  feed: [...state.feed],
  values: { ...state.values },
  alignment: { ...state.alignment },
  flags: { ...state.flags },
});

export function conditionHolds(condition: Condition | undefined, state: EpisodeState | Draft) {
  if (condition === undefined) return true;
  const chose = (ref: string) => {
    const [scene, option] = ref.split('.');
    return state.choices[scene!] === option;
  };
  return (
    (condition.chose?.every(chose) ?? true) &&
    (condition.notChose?.every((ref) => !chose(ref)) ?? true) &&
    (condition.has?.every((id) => state.collected.includes(id)) ?? true) &&
    (condition.lacks?.every((id) => !state.collected.includes(id)) ?? true) &&
    Object.entries(condition.flags ?? {}).every(
      ([flag, value]) => (state.flags[flag] ?? false) === value,
    ) &&
    (condition.solved === undefined ||
      Object.values(state.solved).some((solved) => solved === condition.solved)) &&
    (condition.timedOut === undefined || state.timedOut.length > 0 === condition.timedOut)
  );
}

function playBeats(draft: Draft, beats: readonly Beat[] | undefined) {
  for (const beat of beats ?? []) {
    if (!conditionHolds(beat.when, draft)) continue;
    if ('narrate' in beat) draft.feed.push({ kind: 'narrate', text: beat.narrate });
    else if ('speaker' in beat)
      draft.feed.push({ kind: 'line', speaker: beat.speaker, text: beat.text });
    else if ('log' in beat) draft.feed.push({ kind: 'log', text: beat.log });
    else if ('metric' in beat) draft.feed.push({ kind: 'metric', ...beat.metric });
    else if (!draft.collected.includes(beat.collect)) {
      draft.collected.push(beat.collect);
      draft.feed.push({ kind: 'evidence', id: beat.collect });
    }
  }
}

function applyEffects(draft: Draft, effects: Effects | undefined) {
  if (effects === undefined) return;
  for (const [key, amount] of Object.entries(effects.values ?? {}))
    draft.values[key as StoryValue] += amount;
  for (const [key, amount] of Object.entries(effects.alignment ?? {}))
    draft.alignment[key as StoryAlignment] += amount;
  Object.assign(draft.flags, effects.flags);
  draft.pressure = Math.max(0, draft.pressure + (effects.pressure ?? 0));
}

export function findScene(episode: Episode, sceneId: string): Scene {
  const scene = episode.scenes.find((s) => s.id === sceneId);
  if (scene === undefined) throw new StoryInputError(`${episode.id} has no scene "${sceneId}".`);
  return scene;
}

function enter(episode: Episode, draft: Draft, sceneId: string) {
  draft.attempts = 0;
  if (sceneId === END) {
    draft.sceneId = null;
    return;
  }
  draft.sceneId = sceneId;
  draft.feed.push({ kind: 'scene', sceneId });
  playBeats(draft, findScene(episode, sceneId).beats);
}

export function startEpisode(episode: Episode, carry: CampaignCarry = emptyCarry): EpisodeState {
  const draft: Draft = {
    episodeId: episode.id,
    sceneId: null,
    attempts: 0,
    collected: [],
    choices: {},
    solved: {},
    timedOut: [],
    pressure: 0,
    feed: [],
    values: { ...emptyCarry.values, ...carry.values },
    alignment: { ...emptyCarry.alignment, ...carry.alignment },
    flags: { ...carry.flags },
  };
  enter(episode, draft, episode.start);
  return draft;
}

export function currentScene(episode: Episode, state: EpisodeState): Scene | undefined {
  return state.sceneId === null ? undefined : findScene(episode, state.sceneId);
}

// Options the player can pick now (an option's `when` is checked on entry state).
export function availableOptions(scene: ChoiceScene, state: EpisodeState): StoryOption[] {
  return scene.options.filter((option) => conditionHolds(option.when, state));
}

// Evidence on the board that a deduction may cite: everything collected so far.
export function deductionCandidates(state: EpisodeState): readonly string[] {
  return state.collected;
}

function choose(
  episode: Episode,
  scene: ChoiceScene,
  draft: Draft,
  option: StoryOption,
  timedOut: boolean,
) {
  draft.choices[scene.id] = option.id;
  if (timedOut) {
    draft.timedOut.push(scene.id);
    playBeats(draft, scene.timer?.beats);
  }
  draft.feed.push({ kind: 'choice', sceneId: scene.id, optionId: option.id, timedOut });
  playBeats(draft, option.beats);
  applyEffects(draft, option.effects);
  const target = option.next ?? scene.next;
  if (target === undefined)
    throw new StoryInputError(`${episode.id}/${scene.id}.${option.id} has nowhere to go.`);
  enter(episode, draft, target);
}

function deduce(episode: Episode, scene: DeductionScene, draft: Draft, picks: readonly string[]) {
  const unique = new Set(picks);
  if (unique.size !== picks.length || picks.some((id) => !draft.collected.includes(id)))
    throw new StoryInputError('A deduction cites each collected evidence item at most once.');
  if (picks.length !== scene.solution.length)
    throw new StoryInputError(`Pick exactly ${scene.solution.length} pieces of evidence.`);
  const correct = scene.solution.every((id) => unique.has(id));
  draft.feed.push({ kind: 'deduction', sceneId: scene.id, picks: [...picks].sort(), correct });
  draft.attempts += 1;
  if (!correct && draft.attempts < scene.attempts) {
    playBeats(draft, scene.hint);
    return;
  }
  draft.solved[scene.id] = correct;
  const outcome = correct ? scene.solved : scene.missed;
  playBeats(draft, outcome.beats);
  applyEffects(draft, outcome.effects);
  enter(episode, draft, scene.next);
}

export function applyStoryInput(
  episode: Episode,
  state: EpisodeState,
  input: StoryInput,
): EpisodeState {
  const scene = currentScene(episode, state);
  if (scene === undefined) throw new StoryInputError(`${episode.id} has already ended.`);
  const draft = draftOf(state);
  switch (scene.type) {
    case 'briefing':
      if (input.type !== 'continue') throw new StoryInputError(`"${scene.id}" only continues.`);
      applyEffects(draft, scene.effects);
      enter(episode, draft, scene.next);
      break;
    case 'choice': {
      if (input.type === 'timeout') {
        if (scene.timer === undefined) throw new StoryInputError(`"${scene.id}" has no timer.`);
        const fallback = scene.options.find((o) => o.id === scene.timer!.default)!;
        choose(episode, scene, draft, fallback, true);
      } else if (input.type === 'choose') {
        const option = availableOptions(scene, state).find((o) => o.id === input.optionId);
        if (option === undefined)
          throw new StoryInputError(`"${input.optionId}" is not available in "${scene.id}".`);
        choose(episode, scene, draft, option, false);
      } else throw new StoryInputError(`"${scene.id}" needs a choice.`);
      break;
    }
    case 'deduction':
      if (input.type !== 'deduce') throw new StoryInputError(`"${scene.id}" needs a deduction.`);
      deduce(episode, scene, draft, input.picks);
      break;
  }
  return draft;
}

// The carry handed to the next episode.
export function episodeCarry(state: EpisodeState): CampaignCarry {
  return { values: state.values, alignment: state.alignment, flags: state.flags };
}
