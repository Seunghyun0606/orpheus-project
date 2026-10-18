// Story episodes from the terminal (DEC-072).
//
//   node scripts/story/story.mjs play INC-001 [--lang ko|en] [--no-timer] [--fast]
//   node scripts/story/story.mjs script INC-001 [--lang ko|en]   every scene and branch, as Markdown
//   node scripts/story/story.mjs check                           validate every episode in campaign order
//   node scripts/story/story.mjs check INC-010                   one episode on its own, under every
//                                                                combination of the flags it reads
//
// The terminal player is a review tool for writers and playtesters until the
// Godot build exists; it runs the same reference runner the tests use.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parse } from 'yaml';

import {
  applyStoryInput,
  availableOptions,
  currentScene,
  startEpisode,
  StoryInputError,
} from '../../src/story/runner.ts';
import { parseEpisode } from '../../src/story/schema.ts';
import { campaignCarries, soloCarries, validateEpisode } from '../../src/story/validate.ts';

const DATA = 'src/story/data/';
const TIMEOUT = Symbol('timeout');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
const lang = option('--lang') ?? (systemLocale.startsWith('ko') ? 'ko' : 'en');

const ui = {
  en: {
    continue: 'Enter ▸ continue',
    pick: 'Choose a number',
    board: 'b ▸ evidence board',
    boardTitle: 'Evidence board',
    added: 'Added to the evidence board',
    seconds: (n) => `⏱ ${n}s`,
    left: (n) => `⏱ ${n}s left`,
    timeUp: '⏱ Time is up.',
    deduce: (n) => `Pick ${n} pieces of evidence by number, separated by spaces`,
    right: 'Deduction holds.',
    wrong: 'That does not explain it.',
    end: 'End of episode',
    pressure: 'Pressure',
    values: 'Values',
    alignment: 'Alignment',
    flags: 'Flags',
    choices: 'Choices',
    timedOut: '(timer)',
    notFound: (id) => `No episode ${id}. Available: `,
    scene: { briefing: 'Scene', choice: 'Choice', deduction: 'Deduction' },
    timer: (s, d) => `Timer ${s}s · on expiry: ${d}`,
    when: 'only if',
    solution: 'Solution',
    hint: 'After a miss',
    solved: 'Solved',
    missed: 'Missed',
    next: 'Next',
    effects: 'Effects',
  },
  ko: {
    continue: 'Enter ▸ 계속',
    pick: '번호를 고르세요',
    board: 'b ▸ 증거 보드',
    boardTitle: '증거 보드',
    added: '증거 보드에 추가됨',
    seconds: (n) => `⏱ ${n}초`,
    left: (n) => `⏱ ${n}초 남음`,
    timeUp: '⏱ 시간이 다 됐다.',
    deduce: (n) => `증거 ${n}개를 번호로 고르세요 (띄어쓰기로 구분)`,
    right: '추론이 맞아떨어진다.',
    wrong: '그걸로는 설명되지 않는다.',
    end: '에피소드 끝',
    pressure: '압박',
    values: '가치',
    alignment: '진영',
    flags: '플래그',
    choices: '선택',
    timedOut: '(시간 초과)',
    notFound: (id) => `${id} 에피소드가 없습니다. 있는 것: `,
    scene: { briefing: '장면', choice: '선택', deduction: '추론' },
    timer: (s, d) => `제한 시간 ${s}초 · 초과 시: ${d}`,
    when: '조건',
    solution: '정답',
    hint: '틀렸을 때',
    solved: '맞힘',
    missed: '못 맞힘',
    next: '다음',
    effects: '효과',
  },
}[lang];

function loadEpisodes() {
  return readdirSync(DATA)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parseEpisode(readFileSync(DATA + f, 'utf8')));
}

function dictionary(episode) {
  if (lang === 'en') return (text) => text;
  const file = `src/i18n/content/${lang}/story-${episode.id.toLowerCase()}.yaml`;
  const entries = parse(readFileSync(file, 'utf8')).entries;
  const map = new Map(entries.map((e) => [e.en, e[lang]]));
  return (text) => map.get(text) ?? text;
}

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = color('2');
const amber = color('33');
const cyan = color('36');
const green = color('32');
const red = color('31');
const bold = color('1');

// Reads only this episode's file, so other episodes being written cannot
// break a single-episode check.
function episodeById(id) {
  const file = `${DATA}${String(id).toLowerCase()}.yaml`;
  if (!existsSync(file)) {
    const ids = readdirSync(DATA).filter((f) => f.endsWith('.yaml'));
    console.error(ui.notFound(id) + ids.join(', '));
    process.exit(1);
  }
  return parseEpisode(readFileSync(file, 'utf8'));
}

async function play(episode) {
  const t = dictionary(episode);
  const fast = flag('--fast');
  const timed = !flag('--no-timer');
  const names = new Map(episode.cast.map((c) => [c.id, t(c.name)]));
  const evidence = new Map(episode.evidence.map((e) => [e.id, e]));
  const rl = createInterface({ input: process.stdin, terminal: false });
  const pause = (ms) => (fast ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

  async function show(entries) {
    for (const entry of entries) {
      switch (entry.kind) {
        case 'scene': {
          const title = episode.scenes.find((s) => s.id === entry.sceneId).title;
          if (title)
            console.log(
              bold(`
— ${t(title)} —`),
            );
          continue;
        }
        case 'narrate':
          console.log(dim(t(entry.text)));
          break;
        case 'line':
          console.log(`${cyan(names.get(entry.speaker) ?? entry.speaker)}  ${t(entry.text)}`);
          break;
        case 'log':
          console.log(green(`  $ ${t(entry.text)}`));
          break;
        case 'metric': {
          const arrow = { up: '▲', down: '▼', flat: '─' }[entry.trend] ?? ' ';
          console.log(`  ${amber(arrow)} ${t(entry.label)}: ${bold(t(entry.value))}`);
          break;
        }
        case 'evidence': {
          const item = evidence.get(entry.id);
          console.log(amber(`  📎 ${ui.added}: ${t(item.title)}`));
          console.log(dim(`     ${t(item.body)}`));
          break;
        }
        case 'deduction':
          console.log(entry.correct ? green(`  ✓ ${ui.right}`) : red(`  ✗ ${ui.wrong}`));
          break;
        default:
          break;
      }
      await pause(entry.kind === 'metric' || entry.kind === 'log' ? 250 : 650);
    }
  }

  const board = (state) =>
    state.collected.map((id, i) => `  ${i + 1}. ${t(evidence.get(id).title)}`).join('\n');

  // Lines are queued so piped input (playtest scripts) works like typing.
  const queued = [];
  let waiting;
  let closed = false;
  rl.on('line', (line) => (waiting ? waiting(line) : queued.push(line)));
  rl.on('close', () => {
    closed = true;
    waiting?.(undefined);
  });

  // The next line, or TIMEOUT when `seconds` pass first. Ends quietly on EOF.
  async function ask(question, seconds) {
    process.stdout.write(question);
    if (queued.length > 0) {
      const line = queued.shift();
      if (!process.stdin.isTTY) console.log(line);
      return line;
    }
    if (closed) process.exit(0);
    const timers = [];
    const answer = await new Promise((resolve) => {
      waiting = (line) => {
        waiting = undefined;
        resolve(line);
      };
      if (seconds !== undefined) {
        timers.push(setTimeout(() => console.log(red(`\n${ui.left(10)}`)), (seconds - 10) * 1000));
        timers.push(setTimeout(() => waiting?.(TIMEOUT), seconds * 1000));
      }
    });
    timers.forEach(clearTimeout);
    if (answer === undefined) process.exit(0);
    return answer;
  }

  // Entered as on the first campaign path that reaches this episode.
  const carry = campaignCarries(loadEpisodes()).get(episode.id)[0];
  let state = startEpisode(episode, carry);
  console.log(bold(`\n${episode.id} · ${t(episode.title)}\n`));
  let shown = 0;
  for (;;) {
    const scene = currentScene(episode, state);
    await show(state.feed.slice(shown));
    shown = state.feed.length;
    if (scene === undefined) break;
    let input;
    if (scene.type === 'briefing') {
      await ask(dim(`\n${ui.continue} `));
      input = { type: 'continue' };
    } else if (scene.type === 'choice') {
      const options = availableOptions(scene, state);
      console.log(`\n${bold(t(scene.prompt))}`);
      options.forEach((o, i) => {
        const cost = o.consequence ? dim(`  — ${t(o.consequence)}`) : '';
        console.log(`  ${i + 1}) ${t(o.text)}${cost}`);
      });
      // Pressure takes 5 s a level off the timer, never below 15 s (as in Godot).
      const seconds =
        timed && scene.timer
          ? Math.max(Math.min(15, scene.timer.seconds), scene.timer.seconds - 5 * state.pressure)
          : undefined;
      if (seconds !== undefined) console.log(red(ui.seconds(seconds)));
      for (;;) {
        const answer = await ask(`${ui.pick} (${ui.board}) > `, seconds);
        if (answer === TIMEOUT) {
          console.log(red(`\n${ui.timeUp}`));
          input = { type: 'timeout' };
          break;
        }
        if (answer.trim() === 'b') {
          console.log(`${ui.boardTitle}\n${board(state)}`);
          continue;
        }
        const picked = options[Number(answer) - 1];
        if (picked) {
          input = { type: 'choose', optionId: picked.id };
          break;
        }
      }
    } else {
      console.log(`\n${bold(t(scene.prompt))}\n${ui.boardTitle}\n${board(state)}`);
      for (;;) {
        const answer = await ask(`${ui.deduce(scene.solution.length)} > `);
        const picks = answer
          .trim()
          .split(/\s+/)
          .map((n) => state.collected[Number(n) - 1]);
        if (picks.every(Boolean) && picks.length === scene.solution.length) {
          input = { type: 'deduce', picks };
          break;
        }
      }
    }
    try {
      state = applyStoryInput(episode, state, input);
    } catch (error) {
      if (error instanceof StoryInputError) console.log(red(error.message));
      else throw error;
    }
  }
  rl.close();
  summary(episode, state, t);
}

function summary(episode, state, t) {
  const nonzero = (record) =>
    Object.entries(record)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
      .join(', ') || '—';
  console.log(bold(`\n— ${ui.end} —`));
  const choices = state.feed
    .filter((e) => e.kind === 'choice')
    .map((e) => {
      const scene = episode.scenes.find((s) => s.id === e.sceneId);
      const option = scene.options.find((o) => o.id === e.optionId);
      return `  · ${t(scene.prompt)} → ${t(option.text)}${e.timedOut ? ` ${ui.timedOut}` : ''}`;
    });
  console.log(`${ui.choices}\n${choices.join('\n')}`);
  console.log(`${ui.values}: ${nonzero(state.values)}`);
  console.log(`${ui.alignment}: ${nonzero(state.alignment)}`);
  console.log(`${ui.pressure}: ${state.pressure}`);
  console.log(`${ui.flags}: ${Object.keys(state.flags).join(', ') || '—'}`);
}

// The whole episode as a readable script for review.
function script(episode) {
  const t = dictionary(episode);
  const names = new Map(episode.cast.map((c) => [c.id, t(c.name)]));
  const evidence = new Map(episode.evidence.map((e) => [e.id, e]));
  const out = [`# ${episode.id} · ${t(episode.title)}`, ''];
  const cond = (when) =>
    when
      ? ` _(${ui.when}: ${Object.entries(when)
          .map(([k, v]) => `${k} ${JSON.stringify(v)}`)
          .join('; ')})_`
      : '';
  const fx = (effects) => {
    if (!effects) return [];
    const parts = [
      ...Object.entries(effects.values ?? {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`),
      ...Object.entries(effects.alignment ?? {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`),
      ...Object.entries(effects.flags ?? {}).map(([k, v]) => `${k}=${v}`),
      ...(effects.pressure ? [`${ui.pressure} +${effects.pressure}`] : []),
    ];
    return parts.length ? [`  - _${ui.effects}: ${parts.join(', ')}_`] : [];
  };
  const beat = (b, indent = '') => {
    const c = cond(b.when);
    if ('narrate' in b) return `${indent}_${t(b.narrate)}_${c}`;
    if ('speaker' in b) return `${indent}**${names.get(b.speaker)}**: ${t(b.text)}${c}`;
    if ('log' in b) return `${indent}\`${t(b.log)}\`${c}`;
    if ('metric' in b) return `${indent}📈 ${t(b.metric.label)}: **${t(b.metric.value)}**${c}`;
    const item = evidence.get(b.collect);
    return `${indent}📎 **${t(item.title)}** — ${t(item.body)}${c}`;
  };
  const beats = (list, indent = '') => (list ?? []).map((b) => `${indent}- ${beat(b)}`);
  for (const scene of episode.scenes) {
    out.push(
      `## ${ui.scene[scene.type]} · ${scene.title ? t(scene.title) : scene.id} \`${scene.id}\``,
      '',
    );
    out.push(...beats(scene.beats));
    if (scene.type === 'briefing')
      out.push(...fx(scene.effects), '', `→ ${ui.next}: \`${scene.next}\``);
    if (scene.type === 'choice') {
      out.push('', `**${t(scene.prompt)}**`);
      if (scene.timer) {
        const fallback = scene.options.find((o) => o.id === scene.timer.default);
        out.push(
          '',
          `⏱ ${ui.timer(scene.timer.seconds, t(fallback.text))}`,
          ...beats(scene.timer.beats, '  '),
        );
      }
      out.push('');
      scene.options.forEach((o, i) => {
        const cost = o.consequence ? ` — _${t(o.consequence)}_` : '';
        out.push(`${i + 1}. **${t(o.text)}**${cost}${cond(o.when)} \`${o.id}\``);
        out.push(...beats(o.beats, '   '), ...fx(o.effects).map((l) => ' ' + l));
        if (o.next) out.push(`   → ${ui.next}: \`${o.next}\``);
      });
      if (scene.next) out.push('', `→ ${ui.next}: \`${scene.next}\``);
    }
    if (scene.type === 'deduction') {
      out.push('', `**${t(scene.prompt)}**`, '');
      out.push(
        `- ${ui.solution}: ${scene.solution.map((id) => t(evidence.get(id).title)).join(' + ')}`,
      );
      out.push(`- ${ui.hint}:`, ...beats(scene.hint, '  '));
      out.push(`- ${ui.solved}:`, ...beats(scene.solved.beats, '  '), ...fx(scene.solved.effects));
      out.push(`- ${ui.missed}:`, ...beats(scene.missed.beats, '  '), ...fx(scene.missed.effects));
      out.push('', `→ ${ui.next}: \`${scene.next}\``);
    }
    out.push('');
  }
  console.log(out.join('\n').replace(/\n{3,}/g, '\n\n'));
}

const [command, id] = args;
if (command === 'play') await play(episodeById(id));
else if (command === 'script') script(episodeById(id));
else if (command === 'check') {
  let failed = false;
  const solo = id !== undefined;
  const episodes = solo ? [episodeById(id)] : loadEpisodes();
  const carries = solo ? undefined : campaignCarries(episodes);
  for (const episode of episodes) {
    const problems = validateEpisode(
      episode,
      solo ? soloCarries(episode) : carries.get(episode.id),
    );
    console.log(`${episode.id}: ${problems.length === 0 ? 'ok' : problems.length + ' problems'}`);
    for (const p of problems) console.log(`  ${p}`);
    failed ||= problems.length > 0;
  }
  if (failed) process.exitCode = 1;
} else {
  console.log(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 7)
      .join('\n'),
  );
}
