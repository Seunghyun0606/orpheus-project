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

## War Room authoring contract

`warRoom.roles`는 표시 이름과 안정적인 역할 ID를, `warRoom.messages`는 역할 ID와 작성된 문구를 정의한다. `initial: true` 메시지는 시작 시 보이며, 나머지는 `post_message` effect가 실행될 때만 이벤트 로그에 기록된다. 문구는 불확실하거나 서로 상충할 수 있으며 엔진은 진실 여부를 판정하지 않는다.

위임 행동은 `DELEGATE` category와 `delegation` metadata (`roleId`, `eventId`, `capacityResourceId`)를 선언한다. 유효한 위임은 사용 가능한 capacity가 1 이상이라는 requirement, -1 capacity cost, 종료 시 +1을 복구하는 취소 불가능한 timer event, 그리고 해당 timer를 예약하는 effect를 가져야 한다. Timer의 delay는 행동 duration보다 길어야 한다. 진행 중 작업은 기존 `scheduledWork`, 메시지 이력은 기존 `eventLog`에 남으므로 새로운 저장 상태 필드는 필요하지 않다.

TASK-014의 승인된 호환성 정책은 기존 1.0.0 YAML을 변경 불가능한 재생 기준으로 보존하고 현재 Incident를 1.1.0으로 올리는 것이다. 불러오기는 먼저 1.0.0 규칙으로 저장을 검증한 뒤 같은 행동 기록을 1.1.0 규칙으로 재생한다. 재생할 수 없는 상태는 거부하며, 불러오기 자체는 저장 슬롯을 덮어쓰지 않는다. 다음 저장 명령에서만 업그레이드된 상태를 기록한다. 이후 콘텐츠 버전 변경은 새 기준과 대상 버전을 명시해야 한다.

## M3 Incident Authoring Checklist

- 새 Incident는 `src/scenario/data/incidents/` 아래의 독립 YAML 파일로 작성한다. 파일명과 별개로 `id`는 저장·replay에 쓰이는 안정된 고유값이며, 내용을 변경할 때 `contentVersion` 호환성을 확인한다.
- `src/scenario/__fixtures__/valid-second-incident.yaml`은 두 번째 시나리오의 최소 계약 예제다. 본편 스토리 콘텐츠가 아니라 파서·카탈로그 검증용으로만 사용한다.
- 서비스와 종속 관계, 초기 signal/resource/flag, trigger·failure mechanism·symptom, 행동과 비용·효과, resolution·completion, postmortem 입력을 정의한다. 필요하면 event, evidence, narrative를 추가한다.
- 모든 참조 대상은 같은 시나리오에 선언하고 namespace별 id를 중복 없이 유지한다. 카탈로그는 여러 파일의 시나리오 id 중복까지 검사한다.
- `npm run validate:scenarios`와 해당 Incident의 headless replay 테스트를 통과시킨다. Scenario, Narrative, Evidence를 React 조건문에 넣지 않는다.
- MVP 콘텐츠는 UNKNOWN의 존재까지만 공개한다. NULL, ORPHEUS의 정체와 후반 반전은 추가하지 않는다.
