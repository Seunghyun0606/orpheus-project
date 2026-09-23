# Incident Simulation Requirements

## Gameplay Loop

1. Pager alert와 초기 영향 확인
2. 로그, 지표, 서비스 구조와 인프라 관찰
3. 증거 수집과 가설 형성
4. 직접 조치 또는 팀 위임
5. 행동 시간 경과와 예약 이벤트 실행
6. 변화한 시스템에서 추가 증거 확인
7. 서비스 복구와 root cause 처리
8. 사후 분석과 Narrative 발견

## Incident Model

Incident는 하나의 정답이 아니라 다음 인과 요소의 조합이다.

- trigger
- contributing factors
- failure mechanisms
- symptoms
- amplifiers
- customer impact

엔진은 증상 수치만 바꾸는 임시 완화와 failure mechanism을 제거하는 해결을 구분해야 한다. 예를 들어 API restart는 연결 수와 오류율을 잠시 낮추지만, stale session이 남아 있으면 예약된 시간 뒤 다시 악화된다.

## Actions and Time

지원할 행동 분류는 `OBSERVE`, `DIAGNOSE`, `DELEGATE`, `MITIGATE`, `MODIFY`, `COMMUNICATE`, `INVESTIGATE`다.

모든 행동은 데이터로 정의된 시간을 소비한다. 시간 경과는 임시 효과 만료, retry storm, 지원팀 escalation, 지역 장애와 같은 예약 이벤트를 실행할 수 있다. 조치의 결과는 즉시·지연 효과, 조건부 reveal, 비용과 위험 변화를 함께 포함할 수 있다.

## Player-Facing Resources

- time
- service health
- customer impact
- cost
- team capacity
- evidence
- trust

리소스 간 trade-off를 보여주되 성공/실패 점수 하나로 축약하지 않는다.

## War Room and Delegation

초기 주요 역할은 SRE Lead Maya, DBA Alex, Platform Sam, Support Jin, Security Marcus다. 위임은 즉시 결과가 아니라 ETA를 가진 작업으로 예약되며 team capacity를 점유한다. 대화는 상태 설명뿐 아니라 불완전하거나 상충하는 정보도 제공할 수 있다.

## Postmortem

Incident 종료 후 다음을 설명 가능한 근거와 함께 보여준다.

- service recovery time
- root cause accuracy
- customer impact
- operational risk
- unnecessary actions
- communication

표현은 정답/오답 판정이 아니라 플레이어 행동과 결과 사이의 인과를 되짚는 방식이어야 한다.

## Verification Expectations

자동 테스트는 action mutation, temporary effect expiration, delayed event, dependency propagation, customer impact와 조건부 reveal을 포함해야 한다.
