# System Architecture

## Stack

- Tauri desktop shell
- React + TypeScript + Vite UI
- Zustand UI adapter/state projection
- Zod runtime schemas
- YAML authored content

구체적인 package version은 구현 시점의 호환 가능한 stable release를 선택하고 lockfile로 고정한다.

## Layer Boundaries

```text
Tauri shell
  └─ React UI
       └─ Zustand adapter / projections
            └─ Pure TypeScript domain
                 ├─ simulation and action engine
                 ├─ event and signal engine
                 ├─ narrative and evidence engine
                 ├─ campaign and player model
                 └─ ending resolver
```

- `engine/`은 React, DOM, Tauri API를 import하지 않는다.
- UI는 engine command를 보내고 immutable result/event를 projection한다. Simulation rule을 소유하지 않는다.
- Scenario, Narrative, Evidence, Campaign과 Ending 콘텐츠는 schema-validated data다.
- Tauri와 persistence adapter는 platform I/O를 domain model에서 격리한다.

## Determinism

동일한 scenario version, seed, initial state와 ordered action log는 동일한 state와 emitted event를 만들어야 한다.

- domain에서 `Math.random()`과 wall-clock 직접 호출을 금지한다.
- RNG와 clock은 명시적인 engine dependency 또는 state로 전달한다.
- action log에는 순서, action id, 대상과 결정에 필요한 입력을 기록한다.
- replay test는 최종 state뿐 아니라 주요 emitted event도 비교한다.

## Persistence

저장은 local-first다. Save envelope에는 schema version, content version, campaign state, incident history, evidence, player model, settings, narrative/ending flags와 replay metadata를 포함한다. 마이그레이션이 없는 incompatible save는 조용히 손상시키지 않고 명확한 오류를 반환한다.

## Validation Boundary

빌드 또는 전용 `validate:scenarios` 명령은 schema, duplicate id, invalid reference, unknown flag, missing signal/action, invalid narrative condition와 ending reference를 검사한다. 파싱된 이후의 engine 입력은 validated type으로 취급한다.

## Target Source Shape

```text
src/
  app/
  engine/{simulation,action,event,signals,scoring,narrative,campaign,player-model}/
  scenario/{schema,parser,data}/
  store/
  ui/
  persistence/
  audio/
  assets/
  tests/
```

초기 구현은 이 구조를 맹목적으로 모두 생성하지 않고, 첫 사용 시점에 필요한 경계부터 만든다.
