# INC-001 Connection Saturation Vertical Slice

## Objective

첫 수직 슬라이스는 장애 관찰, 임시 완화, root cause 해결과 Narrative 발견을 한 Incident 안에서 증명한다.

## System and Initial State

서비스 경로는 `Gateway → Payment API → PostgreSQL`이다.

초기 신호:

| Signal | Value |
| --- | ---: |
| API error rate | 31% |
| DB connections | 498 / 500 |
| DB CPU | 41% |
| API CPU | 67% |

Pager는 `SEV1`, `Payment API`, `Error Rate > 20%`를 표시한다.

## Required Observations and Actions

초기 접근 가능한 행동은 Open Logs, Open Metrics, Restart API, Scale API, Rollback, Inspect DB다. 조사로 `Inspect Sessions`가 열리고, 다음 상태를 발견한다.

- 164 connections
- state: `idle in transaction`
- average age: `47m`

`Terminate Stale Sessions`는 발견 조건을 요구하는 root-cause action이다.

## Required Consequences

- Restart API 직후 error rate는 31%에서 3%, connections는 498에서 310으로 감소한다.
- 원인이 남아 있으면 180초 뒤 connections는 499, error rate는 28%로 재악화한다.
- stale sessions를 종료하면 connections는 112, error rate는 0.2%로 회복한다.
- Scale과 Rollback은 관측 가능한 비용 또는 시간과 제한된 효과를 가져야 하며 root cause를 제거해서는 안 된다.

수치는 시나리오 데이터에 정의하고 UI나 엔진 코드에 INC-001 전용 상수로 넣지 않는다.

## Narrative Hook

조건을 충족한 조사 경로에서는 종료 직전 `02:23:11 / UNKNOWN: Good.` 메시지가 나타난 뒤 사라진다. 플레이어가 필요한 증거를 확보했다면 `CORRUPTED_LOG_ENTRY`가 Evidence로 영속화된다.

## Postmortem

사후 분석은 복구 시간, 원인 규명, 고객 피해, 운영 위험, 불필요한 행동과 커뮤니케이션을 실제 action log에서 계산한다. restart를 선택한 플레이와 바로 조사한 플레이 모두 설명 가능한 결과를 제공해야 한다.

## Definition of Done

- Tauri desktop에서 전체 Incident를 플레이할 수 있다.
- YAML load와 scenario validation이 성공한다.
- logs, metrics, action-driven time, temporary effect와 delayed event가 작동한다.
- root cause resolution과 customer impact가 반영된다.
- postmortem, UNKNOWN hint와 Evidence persistence가 작동한다.
- save/load와 deterministic replay가 동일 상태를 복원한다.
- 핵심 동작이 자동 테스트로 검증된다.
