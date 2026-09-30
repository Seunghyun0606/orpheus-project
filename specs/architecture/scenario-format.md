# Scenario Format Requirements

## Authoring Goals

YAML 작성자가 React 또는 simulation code를 수정하지 않고 Incident, actions, signals, scheduled events와 narrative hooks를 조합할 수 있어야 한다. Authoring 오류는 플레이 중이 아니라 validation 단계에서 경로와 원인을 포함해 보고한다.

## Required Top-Level Concepts

- stable scenario id, title, act and severity
- participating services and their relationships
- initial signals and resources
- trigger, contributing factors, failure mechanisms, symptoms and amplifiers
- action definitions and availability requirements
- immediate, temporary and delayed effects
- scheduled events and cancellation conditions
- reveal, evidence and narrative triggers
- resolution and completion conditions
- postmortem scoring inputs
- schema/content version

## Action Contract

각 action은 stable id, category와 duration을 가진다. 필요에 따라 다음을 선언할 수 있다.

- requirements: 이미 관찰한 signal, evidence 또는 flag
- costs: time 외 resource 변화
- effects: 즉시 state mutation
- temporary effects: duration과 expiry behavior
- schedules/cancels: future event
- reveals/unlocks: signal, action, evidence 또는 narrative event

엔진은 알 수 없는 effect type을 무시하지 않고 validation error로 처리한다.

## Reference and Identity Rules

- 모든 id는 해당 namespace에서 유일해야 한다.
- reference는 명시된 같은 scenario 또는 허용된 shared catalog를 가리켜야 한다.
- 저장·replay와 연결되는 id는 표시 문자열과 분리하고 이름 변경으로 바뀌지 않는다.
- narrative condition과 ending condition은 임의 코드를 실행하지 않는 선언형 expression으로 제한한다.

## Validator Output

Validator는 가능한 모든 오류를 한 번에 수집하고, 각 오류에 file, data path, error code와 사람이 읽을 수 있는 설명을 제공한다. CI에서 non-zero exit code로 실패할 수 있어야 한다.

## Compatibility

첫 구현은 INC-001에 필요한 최소 schema에서 시작하되, version field와 discriminated effect/event types를 사용해 이후 Incident 확장이 breaking rewrite가 되지 않도록 한다.

## M3 Incident Authoring Checklist

- 새 Incident는 `src/scenario/data/incidents/` 아래의 독립 YAML 파일로 작성한다. 파일명과 별개로 `id`는 저장·replay에 쓰이는 안정된 고유값이며, 내용을 변경할 때 `contentVersion` 호환성을 확인한다.
- `src/scenario/__fixtures__/valid-second-incident.yaml`은 두 번째 시나리오의 최소 계약 예제다. 본편 스토리 콘텐츠가 아니라 파서·카탈로그 검증용으로만 사용한다.
- 서비스와 종속 관계, 초기 signal/resource/flag, trigger·failure mechanism·symptom, 행동과 비용·효과, resolution·completion, postmortem 입력을 정의한다. 필요하면 event, evidence, narrative를 추가한다.
- 모든 참조 대상은 같은 시나리오에 선언하고 namespace별 id를 중복 없이 유지한다. 카탈로그는 여러 파일의 시나리오 id 중복까지 검사한다.
- `npm run validate:scenarios`와 해당 Incident의 headless replay 테스트를 통과시킨다. Scenario, Narrative, Evidence를 React 조건문에 넣지 않는다.
- MVP 콘텐츠는 UNKNOWN의 존재까지만 공개한다. NULL, ORPHEUS의 정체와 후반 반전은 추가하지 않는다.
