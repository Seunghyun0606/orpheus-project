# Story Episode Format

DEC-072의 에피소드 데이터 계약이다. 플레이 구조는 `specs/product/03-choice-driven-story.md`를 따른다.

## Files

| 경로                                       | 역할                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `src/story/data/inc-NNN.yaml`              | 에피소드 원문(영어)                                                  |
| `src/i18n/content/ko/story-inc-NNN.yaml`   | 한국어 카탈로그 (`npm run i18n:catalogs`로 생성, 영어 원문 키)       |
| `src/story/schema.ts`                      | 스키마 (zod)                                                         |
| `src/story/runner.ts`                      | 참조 실행기. Godot 런타임이 같은 결과를 내야 하는 기준               |
| `src/story/validate.ts`                    | 참조 검사와 전체 경로 탐색                                           |
| `scripts/story/story.mjs`                  | `play`(터미널 플레이), `script`(대본 Markdown), `check`(검증)        |
| `src/story/cast.yaml` / `cast.ts`          | 인물 정보(상태 창 '인물' 탭)와 그 스키마·검사                        |
| `src/i18n/content/ko/story-cast.yaml`      | 인물 정보 한국어 카탈로그                                            |

## Episode

```yaml
schemaVersion: 1
id: INC-001 # 기존 Incident ID
act: 1
title: Connection Saturation
cast: [{ id: MAYA, name: Maya / SRE Lead }]
evidence:
  - { id: IDLE_TRANSACTIONS, kind: operational, title: …, body: … }
  - { id: CORRUPTED_LOG_ENTRY, kind: story, guaranteed: true, title: …, body: … }
start: page
scenes: [...]
```

`guaranteed: true`인 증거는 모든 경로에서 수집되어야 한다(검증기가 확인).

## Scenes

모든 장면은 `id`(소문자-케밥), 선택적 `title`, 진입할 때 재생되는 `beats`를 가진다. `next`는 다른 장면 ID 또는 `END`다.

| type        | 입력                | 필드                                                                                                           |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `briefing`  | 계속                | `effects`, `next`                                                                                              |
| `choice`    | 선택지 / 시간 초과  | `prompt`, `options[]`, 선택적 `timer { seconds, default, beats }`, `next`(선택지의 `next`가 우선)                |
| `deduction` | 증거 N개 고르기     | `prompt`, `solution[]`, `attempts`(기본 2), `hint`(틀렸고 기회가 남았을 때), `solved`/`missed { beats, effects }`, `next` |

선택지(option): `id`, `text`, `consequence`(미리 보이는 대가, 정답·오답 표시 금지), `when`, `beats`, `effects`, `next`.

## Beats

한 항목에 하나: `narrate`, `speaker`+`text`, `log`, `metric { label, value, trend }`, `collect`(증거 ID). 모두 `when`을 가질 수 있다.

## Conditions (`when`)

나열한 조건을 모두 만족해야 한다.

- `chose` / `notChose`: `"scene.OPTION"` 목록
- `has` / `lacks`: 이 에피소드에서 모은 증거 ID
- `flags`: `{ FLAG: true|false }` — 이전 에피소드에서 넘어온 플래그 포함
- `solved`: 이 에피소드의 추론을 맞혔는지
- `timedOut`: 이 에피소드에서 시간 초과가 있었는지

## Effects

`values`(7개 가치), `alignment`(`corporate`, `null`), `flags`, `pressure`(에피소드 안의 압박 단계, 0 미만으로 내려가지 않음). 가치·진영·플래그는 다음 에피소드로 넘어간다(`episodeCarry`).

## Runner Contract

- 입력: `continue`, `choose(optionId)`, `timeout`, `deduce(picks)`. 장면에 맞지 않는 입력은 `StoryInputError`.
- 선택지 `when`은 장면 진입 상태로 판단한다. 시간 초과는 `timer.default`를 적용하고 `timer.beats`를 먼저 재생한다.
- 추론: 고른 증거는 보드에 있는 것만, 중복 없이, 정답 개수만큼. 틀리고 기회가 남으면 `hint`를 재생하고 같은 장면에 머문다. 기회를 다 쓰면 `missed`로 진행한다.
- 출력 `feed`: `scene`, `narrate`, `line`, `log`, `metric`, `evidence`, `choice`, `deduction` 항목의 순서 있는 목록. UI(터미널, Godot)는 이 목록만 그린다.
- 같은 에피소드, 같은 넘겨받은 상태, 같은 입력 순서는 같은 상태를 만든다. Godot 런타임은 검증기가 탐색한 모든 경로에서 참조 실행기와 같은 최종 상태를 내야 한다(TASK-038).

## Validator

`npm run validate:story`와 테스트가 다음을 거부한다.

- 중복 ID, 없는 장면·증거·선택지·화자 참조, 장면 순환
- 항상 선택 가능하지 않은 타이머 기본 선택
- 어떤 경로에서 정답 증거를 아직 모으지 못한 추론, 오답이 불가능한 추론 보드
- 선택지가 하나도 없는 상태, 한 번도 고를 수 없는 선택지, 한 번도 모을 수 없는 증거, 도달할 수 없는 장면
- 어떤 경로에서 빠지는 `guaranteed` 증거

## Godot Runtime (TASK-038)

| 경로                                     | 역할                                                              |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `godot/data/episodes/*.json`, `index.json` | `npm run godot:export`가 만드는 에피소드 데이터 (스키마 기본값 포함) |
| `godot/locale/ko.po`                     | `story-*` 카탈로그에서 만든 gettext 번역. Godot `tr()`가 읽는다   |
| `godot/scripts/story/story_runner.gd`    | 참조 실행기의 GDScript 이식                                       |
| `godot/tests/parity.gd`                  | 검증기가 탐색한 모든 경로를 두 실행기로 돌려 최종 상태를 비교    |
| `godot/scripts/ui/main.gd`               | 타이틀, 에피소드 화면, 설정. 실행기의 `feed`만 그린다             |

- `npm run godot:play`: 데이터를 내보내고 게임 창을 연다. `npm run godot:editor`: 에디터로 연다.
- `npm run godot:parity`: 일치 검사. Godot 바이너리는 `GODOT_BIN` → PATH의 `godot` → `../_basic_tool` 순으로 찾는다.
- `npm run check`는 내보낸 데이터가 최신인지 확인한다(Godot 없이도 실행 가능).
- 화면 검수용 인자: `godot --path godot -- --episode=INC-001 --play=c,SESSIONS --shot=out.png` (자세한 형식은 `main.gd` 머리말).

### Play rules in the Godot build

- Dialogue and log lines are typed out (Settings → text speed: normal / fast / instant) and
  stamped with an in-world clock. The clock starts at the episode's first time-of-day scene
  title (e.g. `02:14`), jumps forward to later ones and otherwise advances by entry kind; it
  is derived from the feed alone, so a record shows the same times.
- `user://campaign.json` keeps `after` (carry per finished episode), `records` (entry carry
  + inputs per finished episode) and `current` (the episode in progress). A finished episode
  cannot be played again; choosing it replays its record read-only. Leaving mid-incident
  resumes at the same point. "Start over" on the title erases everything after a second press.
- The closing summary folds away (click its heading or press H) so a record can be read in
  full; the way on (next incident, list) stays. The fold is kept while the game runs.
- The Status window has four tabs: tendencies and leaning, decisions that matter, what you
  know, and People. Everything is read as of the incident on screen.

### People (`src/story/cast.yaml`)

Each character lists `speakers` (episode cast IDs) and/or `from` (an episode ID). A person is
known once one of their speakers has talked in an incident the player reached (the live feed
or an earlier record), or once the `from` episode begins. `traits` (성향) and `background`
(배경) lines, and later `updates` to the name or role, unlock by `after: INC-NNN` (that
episode's close has been reached) and/or `flag: X` (the campaign flag is set; reveal flags
land mid-episode). Locked lines show only as a count. A line must not say more than the story
has revealed by its unlock point, so revelations are gated on the reveal flag that delivers
them. `progress.cast_seen` remembers what the player has looked at; the Status button and the
People tab carry a marker while something is new. `validateCast` checks speakers, episodes
and flags; a test requires a profile for every non-system speaker of more than one episode.

### Pressure

`pressure` is the strain an incident puts on customers and the team (slow fixes, relief
that expires, missed deductions). It matters three ways:

- Each level takes 5 seconds off timed decisions, never below 15 seconds (UI rule, Godot
  and terminal player alike; the runner's inputs are unchanged).
- Beats may read it with `when: { pressure: { gte: N } }` (beats only, like values); every
  timed decision has a colleague line at `gte: 2`.
- When an episode ends, the pressure left is added to `collateralDamage` (runner rule, in
  both runners), so it carries into the campaign.

Dialogue should not name an exact deadline in seconds, since the timer can be shorter.
