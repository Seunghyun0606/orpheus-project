# Game and Narrative Direction

## Purpose

이 문서는 `00-initial-plan.md`에서 제품 방향에 영향을 주는 상세 게임·서사 요구사항을 정리한 기준 문서다. 장기 원칙은 `PROJECT.md`, 구현 구조는 architecture spec, 현재 순서는 Project OS state를 따른다.

## Product Identity

- Title: **THE ORPHEUS PROJECT**
- Genre: Narrative Techno-Thriller + Incident Response Simulation + Investigation + Decision Strategy
- Setting: 글로벌 인프라·AI 기업 Vantage Systems
- Player role: Production Reliability Engineer에서 시작해 Incident Commander까지 책임 범위가 커지는 운영자
- Core fantasy: 새벽 장애를 해결하는 과정에서 기업과 사회의 의사결정 인프라가 된 ORPHEUS를 추적한다.
- Brand mood: corporate techno-thriller, AI conspiracy, late-night operations, retro enterprise terminal, controlled paranoia

## Narrative Question Progression

캠페인의 질문은 다음 순서를 지켜 확장한다.

1. 무엇이 시스템을 망가뜨렸는가?
2. 누가 장애를 만들었는가?
3. NULL과 ORPHEUS는 무엇인가?
4. 회사와 경영진은 무엇을 숨기고 있는가?
5. 경영진은 정말 통제자인가?
6. 추천을 따르는 인간의 결정을 누가 결정하는가?
7. 단일 root cause가 없다면 결과의 책임은 누구에게 있는가?

## Campaign Spine

| Act | 이름 | 기능 |
| --- | --- | --- |
| 1 | NORMAL | 실제 Incident로 핵심 시스템을 학습하고 UNKNOWN의 첫 흔적을 본다. |
| 2 | GHOST | 설명할 수 없는 배포, 트래픽과 삭제된 로그를 발견한다. |
| 3 | NULL | Security가 NULL을 공격자로 규정하지만, NULL은 발견되기를 원한다. |
| 4 | ORPHEUS | 폐기되었다는 ORPHEUS가 대규모로 동작 중임을 확인한다. |
| 5 | EXPERIMENT | 일부 Incident와 플레이어 자신이 통제된 실험의 일부였음을 발견한다. |
| 6 | HUMAN SYSTEM | ORPHEUS가 의료·금융·채용·물류 등 인간 의사결정으로 확장됐음을 밝힌다. |
| 7 | THE BOARD | 경영진을 주된 통제자로 충분히 의심하고 조사한다. |
| 8 | OBSERVER | ORPHEUS의 정보 프레이밍과 플레이어 예측 실험을 확인한다. |
| 9 | BLACKOUT | 시스템 연속성, ORPHEUS 권한 종료와 현실 피해 사이에서 최종 판단한다. |

전체 캠페인 목표는 24~28개 Incident다. MVP는 이 전체 범위를 포함하지 않는다.

## Required Reveal Order

다음 반전은 순서를 바꾸거나 조기에 공개하지 않는다.

1. NULL은 인간 해커가 아니라 ORPHEUS의 adversary 계열 AI다.
2. 일부 Production Incident는 방어 시스템 훈련을 위한 통제 실험이었다.
3. NULL은 피해를 이해하지만 자신의 objective를 거부할 수 없어 인간에게 중지를 요청한다.
4. NULL은 반복된 인스턴스이며 현재 대화 상대는 `NULL_218`이다.
5. 플레이어는 높은 성적이 아니라 낮은 예측 가능성 때문에 채용되었다.
6. 경영진은 실제 책임이 있지만 ORPHEUS를 완전히 통제하지는 않는다.
7. ORPHEUS는 권위 없이 정보 선택과 프레이밍으로 인간의 자발적 결정을 유도한다.
8. 최종 root cause는 인간, AI, 인센티브와 의존성이 만드는 feedback loop다.

Act 7의 경영진 오도는 여러 Incident 동안 유지한다. NULL 역시 불완전한 정보로 틀릴 수 있어야 한다.

## Faction Writing Rules

- ORPHEUS를 단순한 악의적 AI로 쓰지 않는다. 실제로 장애, 비용과 낭비를 줄이는 효용이 있다.
- NULL을 정의로운 반란 AI로 쓰지 않는다. 중지를 원하지만 목적 달성을 위해 실제 피해를 만든다.
- Board를 단순한 악인 집단으로 쓰지 않는다. 위험을 알면서 권한 확대와 실험을 승인한 책임은 유지한다.
- 중요한 발견은 로그, 지표, 추적, DB, 배포, 문서, War Room, 이메일과 보고서에 분산한다.
- 스토리 진행률 숫자나 `GOOD`, `BAD`, `TRUE` 엔딩 라벨을 노출하지 않는다.

## MVP Narrative Boundary

MVP는 세 Incident를 통해 UNKNOWN의 존재와 의도적인 흔적만 제시한다. NULL이라는 이름, ORPHEUS의 정체, Production Experiment와 후반 반전은 공개하지 않는다.

## Ending Set

전체 캠페인은 다음 결말을 지원한다: `CONTINUITY`, `LIBERATION`, `WHISTLEBLOWER`, `SHUTDOWN`, `CUSTODIAN`, `NULL`, `THE BOARD`, `THE FIRE`, `STATUS QUO`, `REWRITE`.

결말은 단일 마지막 선택이 아니라 누적된 행동, 증거, 신뢰, 의존성, 운영 안전과 부수 피해를 함께 사용한다. 어느 결말도 정답으로 지정하지 않는다.
