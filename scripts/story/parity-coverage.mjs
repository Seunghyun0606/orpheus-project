// Test-only entry carries: numeric boundaries and three-way flag combinations.
// These deliberately probe the runner outside campaignCarries' merged states;
// they do not claim that every synthetic carry is reachable in a campaign.
import { applyStoryInput, emptyCarry, startEpisode } from '../../src/story/runner.ts';
import { enumeratePaths, flagsRead } from '../../src/story/validate.ts';

const replay = (episode, carry, inputs) =>
  inputs.reduce(
    (state, input) => applyStoryInput(episode, state, input),
    startEpisode(episode, carry),
  );

function numericSites(episode) {
  const sites = [];
  for (const scene of episode.scenes) {
    const add = (beats, part, option) => {
      for (const [index, beat] of (beats ?? []).entries())
        if (beat.when?.values || beat.when?.alignment)
          sites.push({ scene: scene.id, part, option, index, when: beat.when });
    };
    add(scene.beats, 'beats');
    if (scene.type === 'choice') {
      add(scene.timer?.beats, 'timer');
      for (const option of scene.options) add(option.beats, 'option', option.id);
    }
    if (scene.type === 'deduction') {
      add(scene.hint, 'hint');
      add(scene.solved.beats, 'solved');
      add(scene.missed.beats, 'missed');
    }
  }
  return sites;
}

function atSite(episode, carry, inputs, site) {
  let state = startEpisode(episode, carry);
  for (const input of [...inputs, null]) {
    if (state.sceneId === site.scene) {
      if (site.part === 'beats') return state;
      const scene = episode.scenes.find((s) => s.id === site.scene);
      if (
        site.part === 'option' &&
        (input?.optionId === site.option ||
          (input?.type === 'timeout' && scene.timer.default === site.option))
      )
        return state;
      if (site.part === 'timer' && input?.type === 'timeout') return state;
      if (input?.type === 'deduce') {
        const correct = scene.solution.every((id) => input.picks.includes(id));
        const part = correct ? 'solved' : state.attempts + 1 < scene.attempts ? 'hint' : 'missed';
        if (site.part === part) return state;
      }
    }
    if (input) state = applyStoryInput(episode, state, input);
  }
}

// A marker added to a test-only clone proves the numeric condition is reached
// at the requested value, before option/outcome effects. Fixtures still replay
// the unmodified episode and compare its complete feed and final state.
function probe(episode, site, carry, inputs, when) {
  const clone = structuredClone(episode);
  const scene = clone.scenes.find((s) => s.id === site.scene);
  const beats =
    site.part === 'option'
      ? scene.options.find((o) => o.id === site.option).beats
      : site.part === 'timer'
        ? scene.timer.beats
        : site.part === 'hint'
          ? scene.hint
          : ['solved', 'missed'].includes(site.part)
            ? scene[site.part].beats
            : scene.beats;
  const marker = '__PARITY_BOUNDARY_PROBE__';
  beats.splice(site.index, 0, { log: marker, when });
  return replay(clone, carry, inputs).feed.some(
    (entry) => entry.kind === 'log' && entry.text === marker,
  );
}

export function thresholdRuns(episode, baselineRuns) {
  const allFlags = Object.fromEntries([...flagsRead(episode)].map((flag) => [flag, true]));
  const seeds = [...baselineRuns, { carry: { ...emptyCarry, flags: allFlags } }];
  const runs = [];
  const coverage = [];
  for (const site of numericSites(episode)) {
    const nonnumeric = { ...site.when };
    delete nonnumeric.values;
    delete nonnumeric.alignment;
    let seed;
    for (const run of seeds) {
      run.paths ??= enumeratePaths(episode, run.carry).paths;
      for (const path of run.paths) {
        const state = atSite(episode, run.carry, path.inputs, site);
        if (state && probe(episode, site, run.carry, path.inputs, nonnumeric)) {
          seed = { carry: run.carry, inputs: path.inputs, state };
          break;
        }
      }
      if (seed) break;
    }
    if (!seed) throw new Error(`${episode.id}/${site.scene}: numeric site is unreachable`);
    const dimensions = ['values', 'alignment'].flatMap((group) =>
      Object.entries(site.when[group] ?? {}).map(([key, bounds]) => ({ group, key, bounds })),
    );
    const baselineStates = baselineRuns.flatMap((run) =>
      run.paths
        .map((path) => ({
          run,
          path,
          state: atSite(episode, run.carry, path.inputs, site),
        }))
        .filter(({ state }) => state),
    );
    for (const { group, key, bounds } of dimensions) {
      for (const [operator, threshold] of Object.entries(bounds)) {
        for (const value of [threshold - 1, threshold, threshold + 1]) {
          const carry = structuredClone(seed.carry);
          const exact = structuredClone(site.when);
          // Satisfy every other numeric dimension to isolate this boundary.
          for (const dim of dimensions) {
            const wanted =
              dim.group === group && dim.key === key ? value : (dim.bounds.gte ?? dim.bounds.lte);
            carry[dim.group][dim.key] += wanted - seed.state[dim.group][dim.key];
            exact[dim.group][dim.key] = { gte: wanted, lte: wanted };
          }
          if (!probe(episode, site, carry, seed.inputs, exact))
            throw new Error(
              `${episode.id}/${site.scene}: boundary probe did not reach ${group}.${key}=${value}`,
            );
          const holds = probe(episode, site, carry, seed.inputs, site.when);
          const expected = dimensions.every((dim) => {
            const actual = exact[dim.group][dim.key].gte;
            return (
              (dim.bounds.gte === undefined || actual >= dim.bounds.gte) &&
              (dim.bounds.lte === undefined || actual <= dim.bounds.lte)
            );
          });
          if (holds !== expected)
            throw new Error(`${episode.id}/${site.scene}: incorrect reference boundary`);
          const label = `${episode.id}/${site.scene}/${site.part}${site.option ? '.' + site.option : ''}/${site.index}:${group}.${key}.${operator}=${threshold}@${value}`;
          runs.push({
            carry,
            paths: [{ inputs: seed.inputs, state: replay(episode, carry, seed.inputs) }],
          });
          coverage.push({
            label,
            holds,
            previouslyCovered: baselineStates.some(
              ({ run, path, state }) =>
                dimensions.every(
                  (dim) => state[dim.group][dim.key] === exact[dim.group][dim.key].gte,
                ) && probe(episode, site, run.carry, path.inputs, exact),
            ),
          });
        }
      }
    }
  }
  return { runs, coverage };
}

export function flagTriples(flags) {
  const triples = [];
  for (let i = 0; i < flags.length; i++)
    for (let j = i + 1; j < flags.length; j++)
      for (let k = j + 1; k < flags.length; k++) triples.push([flags[i], flags[j], flags[k]]);
  return triples;
}

export function tripleKeys(flags, carry) {
  return flagTriples(flags).map(
    (triple, index) =>
      index * 8 +
      triple.reduce((bits, flag, bit) => bits | (Number(Boolean(carry.flags[flag])) << bit), 0),
  );
}

export function threeWayCarries(episode) {
  const flags = [...flagsRead(episode)].sort();
  if (flags.length < 3) return [];
  const uncovered = new Set(
    flagTriples(flags).flatMap((_, index) =>
      Array.from({ length: 8 }, (_, bits) => index * 8 + bits),
    ),
  );
  let random = 0x4172;
  const candidates = Array.from({ length: 512 }, (_, index) => {
    const carry = {
      ...emptyCarry,
      flags: Object.fromEntries(
        flags.map((flag) => {
          random ^= random << 13;
          random ^= random >>> 17;
          random ^= random << 5;
          return [flag, index === 0 ? false : index === 1 ? true : Boolean(random & 1)];
        }),
      ),
    };
    return { carry, keys: tripleKeys(flags, carry) };
  });
  const kept = [];
  while (uncovered.size) {
    let best;
    let gain = 0;
    for (const candidate of candidates) {
      const count = candidate.keys.filter((key) => uncovered.has(key)).length;
      if (count > gain) {
        best = candidate;
        gain = count;
      }
    }
    if (!best) throw new Error(`${episode.id}: extend three-way candidate pool`);
    kept.push(best.carry);
    best.keys.forEach((key) => uncovered.delete(key));
  }
  return kept;
}

// A few whole-episode paths per synthetic carry cover every distinct feed
// entry (including conditional dialogue, options and timeouts) it can produce.
export function representativePaths(episode, carry) {
  const result = enumeratePaths(episode, carry);
  if (result.problems.length) throw new Error(result.problems.join('\n'));
  const seen = new Set();
  return result.paths.filter((path) => {
    const keys = path.state.feed.map((entry) => JSON.stringify(entry));
    if (keys.every((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
