# Campaign and Player Model Requirements

## Persistent Campaign State

캠페인은 다음 범주의 상태를 local-first 방식으로 보존한다.

- current Act와 완료한 Incident
- 발견한 Evidence와 Narrative flag
- corporate / NULL alignment
- public interest, operational safety, curiosity, evidence, team trust, AI dependency, collateral damage
- 행동에서 파생한 player behavior model
- 결말 판정에 필요한 최종 flag

M3의 최소 진행 기록은 이 전체 모델에 앞서 도입한다. 기존 단일 Incident 저장 키 `orpheus.incident.v1`은 유지하고, 별도 `orpheus.campaign-progress.v1`에 버전별 Incident 발견 스냅샷을 보존한다. 각 스냅샷은 원본 또는 현행 시나리오로 행동 기록과 상태가 일치하는지 검증한 뒤 Evidence와 Narrative 이력을 투영한다. 새로운 발견 때 자동 기록하되, 기존 Incident 슬롯은 명시적 저장 명령이 있어야만 바뀐다. 재시작으로 서로 다른 조사 경로를 밟아도 앞서 찾은 단서는 유지한다. 이는 alignment·player model·ending 상태를 아직 도입하지 않는다.

숨은 변수의 원시 숫자는 플레이어에게 직접 노출하지 않는다. UI는 관계 변화, 조직 반응과 이용 가능한 행동으로 상태를 전달한다.

## Behavior Model

행동 기록으로 최소 다음 경향을 계산한다.

- restart와 rollback 사용 비율
- 행동 전 증거 확인 비율과 평균 조사 깊이
- AI 추천 수용 비율과 prediction deviation
- safety preference와 collateral damage tolerance
- 회사 보고 비율과 NULL 협력 비율

행동 분류와 산식은 data version과 함께 저장해 이후 조정에도 기존 save를 해석할 수 있어야 한다.

## Branching Model

핵심 사건은 공유하되 접근 경로, 정보의 순서, 관계, 위험과 결말 조건이 달라진다. 대표 경향은 company-aligned, NULL-aligned, investigation-heavy, AI-dependent, safety-first다.

분기는 단일 선택지 플래그보다 누적 행동과 발견한 증거를 우선 사용한다. 선택하지 않은 경로의 콘텐츠가 보이지 않는다는 이유만으로 플레이어를 처벌하지 않는다.

## Prediction Feedback

중후반 ORPHEUS는 플레이어의 다음 행동과 confidence를 제시한다. 플레이어가 예측에서 벗어나면 confidence가 갱신되며, 후반에는 최종 행동을 `UNKNOWN`으로 표시할 수 있다. 이 수치는 연출용 임의값이 아니라 player model의 결정론적 결과여야 한다.

## Ending Resolution

Ending 정의, 조건과 우선순위는 데이터로 관리한다. resolver는 campaign state, final incident state와 final actions만으로 결정론적인 결과를 내야 하며 모든 Ending에 fixture 기반 테스트를 둔다.
