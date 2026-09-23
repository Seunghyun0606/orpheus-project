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
