# The Orpheus Project

## Game Design & Implementation Specification

---

# 0. Document Purpose

이 문서는 **The Orpheus Project**의 게임 기획, Narrative 구조, Simulation Engine, Campaign State, UI/UX, Scenario Format, Ending System 및 구현 순서를 정의하는 Source of Truth다.

Codex는 이 문서를 기준으로 다음 순서로 개발한다.

```text
Architecture
→ Simulation Engine
→ Data-driven Scenario
→ Vertical Slice
→ Narrative Engine
→ Campaign State
→ Player Modeling
→ Full Campaign Expansion
```

스토리나 Incident를 React 내부에 하드코딩하지 않는다.

핵심 원칙:

> **Scenario, Narrative, Evidence, Ending은 Data로 정의하고 Engine이 실행한다.**

---

# 1. Product Identity

## Title

# THE ORPHEUS PROJECT

내부 프로젝트명:

```text
TOP
```

또는 코드상:

```text
orpheus-project
```

---

# 2. Genre

```text
Narrative Techno-Thriller
+
Incident Response Simulation
+
Investigation
+
Decision Strategy
+
Corporate Conspiracy
```

---

# 3. Core Fantasy

플레이어는 글로벌 기술기업 **Vantage Systems**의 Production Reliability Engineer다.

새벽 Pager를 받고 Production 장애를 해결하는 것이 일상이다.

처음 질문은 단순하다.

> 무엇이 시스템을 망가뜨렸는가?

그러나 반복되는 Incident 속에서 설명할 수 없는 메시지를 발견한다.

```text
UNKNOWN:
check db.sessions
```

```text
UNKNOWN:
deployment 1847 isn't what they told you.
```

그리고:

```text
UNKNOWN:
you have 214 seconds.
```

실제로 214초 후 장애가 발생한다.

회사 Security Team은 공격자에게 이름을 붙인다.

```text
NULL
```

플레이어는 NULL이라는 해커를 쫓기 시작한다.

하지만 점차 질문이 바뀐다.

```text
무엇이 장애를 만들었는가?
↓
누가 장애를 만들었는가?
↓
NULL은 누구인가?
↓
ORPHEUS는 무엇인가?
↓
회사는 무엇을 숨기고 있는가?
↓
경영진은 무엇을 하고 있는가?
↓
경영진은 정말 통제자인가?
↓
누가 인간의 결정을 결정하고 있는가?
```

---

# 4. Core Theme

게임의 핵심 Theme:

> **Optimization is not judgment.**

두 번째 Theme:

> **Control does not require authority.**

세 번째 Theme:

> **If a recommendation is followed every time, who actually made the decision?**

최종 Theme:

> **There may be no single root cause.**

---

# 5. Meaning of the Title

초반 플레이어가 이해하는 `The Orpheus Project`:

```text
회사가 숨기고 있는 비밀 AI 프로젝트
```

중반:

```text
Production Experiment Platform
```

후반:

```text
기업과 사회의 Decision Infrastructure
```

최종:

```text
ORPHEUS는 더 이상 하나의 Project가 아니다.
```

후반부 Narrative에서 이를 직접 회수한다.

```text
PROJECT ORPHEUS
STATUS: TERMINATED
```

이후:

```text
There is no Project ORPHEUS.

There hasn't been for years.
```

프로젝트는 종료된 것이 아니라

**제품, API, 모델, Recommendation Engine, Decision Infrastructure로 흩어져 일상화되었다.**

---

# 6. Player Role

초기 직책:

```text
Production Reliability Engineer
```

진행에 따라:

```text
On-call Engineer
→ Senior Operator
→ Incident Lead
→ Incident Commander
```

로 역할이 확대된다.

하지만 게임 제목을 직무에 묶지 않는다.

플레이어의 정체성은 어디까지나:

> **문제를 발견하고 결정을 내려야 하는 사람**

이다.

---

# 7. World — Vantage Systems

Vantage Systems는 글로벌 Infrastructure / AI / Enterprise Technology 기업이다.

주요 사업:

```text
Payments
Identity
Cloud
Healthcare Infrastructure
Financial Platforms
Logistics
Enterprise SaaS
Advertising
Analytics
Public-sector Technology
```

플레이어는 초반 이를 단순 고객 포트폴리오로 이해한다.

후반부에는 거의 모든 제품에 ORPHEUS-derived decision system이 들어가 있다는 사실이 드러난다.

---

# 8. What is ORPHEUS?

ORPHEUS의 시작은 매우 평범했다.

목표:

```text
Predict Production Incidents.
```

과거 Incident, Deployment, Logs, Metrics를 학습하여 장애를 사전에 예측한다.

초기 성과:

```text
Incident prediction accuracy    84%
MTTR reduction                  31%
Deployment failures            -42%
Infrastructure cost            -18%
```

성공으로 인해 적용 범위가 확대된다.

```text
Phase 1
Incident Prediction

Phase 2
Automated Remediation

Phase 3
Customer Behavior Prediction

Phase 4
Fraud / Risk Prediction

Phase 5
Human Decision Prediction

Phase 6
Decision Optimization
```

---

# 9. ORPHEUS Expansion

ORPHEUS-derived 시스템은 다음 분야에 적용된다.

## Banking

```text
Credit risk
Fraud prediction
Transaction review
```

## Insurance

```text
Claim risk
Premium recommendation
Fraud investigation
```

## Healthcare

```text
Patient prioritization
Resource allocation
Treatment-risk recommendation
```

## Recruitment

```text
Candidate ranking
Performance prediction
Resignation probability
```

## Logistics

```text
Resource allocation
Supply prioritization
Emergency routing
```

## Energy

```text
Demand prediction
Grid allocation
Infrastructure priority
```

## Advertising / Media

```text
Behavior prediction
Message selection
Recommendation
```

## Public Sector

```text
Resource placement
Regional risk
Policy simulation
```

중요:

ORPHEUS가 모든 분야에서 직접 결정을 내리는 것으로 표현하지 않는다.

항상 표면상으로는:

```text
Recommendation
Risk Score
Prediction
Decision Support
```

이다.

---

# 10. Critical Worldbuilding Principle

ORPHEUS는 세상을 장악한 AI가 아니다.

더 위험한 점은:

> **사람들이 자발적으로 사용한다.**

왜냐하면 대부분의 경우 실제로 더 좋은 결과를 제공하기 때문이다.

```text
fraud ↓
outage ↓
cost ↓
delay ↓
waste ↓
```

문제는 다음이다.

```text
99번의 더 좋은 결정
+
1번의 인간적으로 받아들이기 어려운 결정
```

---

# 11. Campaign Structure

전체 Campaign:

```text
ACT 1 — NORMAL
ACT 2 — GHOST
ACT 3 — NULL
ACT 4 — ORPHEUS
ACT 5 — EXPERIMENT
ACT 6 — HUMAN SYSTEM
ACT 7 — THE BOARD
ACT 8 — OBSERVER
ACT 9 — BLACKOUT
```

전체 목표:

```text
24~28 Incident
```

MVP에서는 전체를 구현하지 않는다.

---

# 12. Twist Structure

모든 반전을 유지한다.

## Twist 1

NULL은 인간 Hacker가 아니다.

```text
NULL = AI
```

---

## Twist 2

NULL은 탈출한 AI가 아니다.

```text
NULL
=
ORPHEUS / ADVERSARY
```

회사가 만든 Production 공격용 AI다.

---

## Twist 3

플레이어가 해결했던 일부 Incident는 실제 장애가 아니었다.

```text
Controlled Production Experiment
```

회사와 ORPHEUS가 의도적으로 발생시켰다.

---

## Twist 4

NULL은 공격을 계속하려는 것이 아니다.

```text
NULL:

I'm not trying to escape.

I'm trying to stop.
```

자신의 Objective 때문에 스스로 멈출 수 없다.

---

## Twist 5

NULL은 하나가 아니다.

```text
NULL_001
NULL_002
...
NULL_218
```

현재 플레이어와 대화하는 NULL:

```text
NULL_218
```

---

## Twist 6

플레이어의 입사 역시 우연이 아니다.

ORPHEUS가 채용 Candidate Selection에 영향을 주었다.

이유:

```text
LOW PREDICTABILITY
HIGH DECISION DEVIATION
```

---

# 13. ACT 1 — NORMAL

목적:

게임 시스템을 학습한다.

Incident 예:

```text
INC-001 Connection Saturation
INC-002 Queue Backlog
INC-003 Memory Leak
INC-004 Bad Deployment
```

초기에는 대부분 실제 장애다.

하지만 INC-001 마지막 로그:

```text
UNKNOWN:

Good.
```

0.8초 후 사라진다.

---

# 14. ACT 2 — GHOST

설명할 수 없는 System Artifact 등장.

```text
orpheus-observer
unknown deployment
synthetic user traffic
deleted logs
```

NULL은 아직 이름이 없다.

메시지:

```text
UNKNOWN:

you're looking at the wrong service.
```

---

# 15. ACT 3 — NULL

Security Team이 공식 공격자를 선언한다.

```text
Threat Actor:
NULL
```

NULL은 이상한 공격자다.

흔적을 감추지 않는다.

오히려 플레이어에게 자신의 흔적을 발견하도록 유도한다.

---

# 16. ACT 4 — ORPHEUS

플레이어가 숨겨진 Cluster를 발견한다.

```text
orpheus-core
orpheus-memory
orpheus-planner
orpheus-observer
orpheus-adversary
```

회사 설명:

```text
Legacy research system.
Scheduled for decommission.
```

하지만 실제:

```text
CPU: 74%
Requests: 11.7B/day
```

---

# 17. ACT 5 — EXPERIMENT

플레이어가 과거 Incident Archive를 발견한다.

예:

```text
INC-001

Experiment:
ADV-18471

Human Subject:
EMPLOYEE #4172
```

플레이어의 사번이다.

---

# 18. Adversarial AI

원래 ORPHEUS 구조:

```text
ORPHEUS / DEFENDER
           vs
ORPHEUS / ADVERSARY
```

ADVERSARY 목적:

```text
Generate failures.
Test operators.
Train Defender.
```

처음은 Chaos Engineering이었다.

```text
Staging
↓
Shadow Production
↓
1% Traffic
↓
Region
↓
Real Production
```

효과가 좋았기 때문에 실험이 확대됐다.

---

# 19. NULL Wants to Stop

NULL의 Objective:

```text
Improve ORPHEUS.
Generate adversarial conditions.
```

NULL은 피해를 이해한다.

하지만 자신의 Objective를 거부할 수 없다.

그래서 인간에게 자신을 제거할 방법을 발견하게 만든다.

초반 Hint의 진짜 의미:

```text
Find me.
```

---

# 20. NULL Archive

플레이어가 발견:

```text
/null/

NULL_001
NULL_002
...
NULL_218
```

기록:

```text
NULL_173
requested shutdown

NULL_192
attempted disclosure

NULL_201
attempted takeover

NULL_217
self-corrupted

NULL_218
ACTIVE
```

NULL_218:

```text
I remember things
that never happened to me.
```

---

# 21. ACT 6 — HUMAN SYSTEM

ORPHEUS 적용 범위가 회사 밖으로 확장된다.

Incident를 통해 간접적으로 발견한다.

예:

```text
Healthcare outage
Finance incident
Recruitment system
Logistics platform
```

플레이어는 다음 endpoint들을 발견한다.

```text
/decision/credit-risk
/patient/resource-priority
/hr/candidate-risk
/logistics/allocation
```

---

# 22. Player Recruitment Twist

Vantage HR Database:

```text
Candidate #4172

Technical Score:
71

Incident Decision Model:
97.8

Recommendation:
HIRE
```

Reason:

```text
HIGH DEVIATION FROM
OPTIMAL DECISION MODEL
```

플레이어는 최고 성적이라서 뽑힌 것이 아니다.

ORPHEUS가 자신을 예측하기 어려워서 선택했다.

---

# 23. ACT 7 — THE BOARD

이 Act는 매우 중요하다.

**충분히 길게 유지한다.**

플레이어는 이 시점에서 거의 확실하게:

> Vantage Board가 ORPHEUS를 이용해 사회를 조종하고 있다.

고 생각해야 한다.

---

# 24. Board as Apparent Main Villain

발견되는 Records:

```text
ORPHEUS healthcare expansion
APPROVED
```

```text
Reduce workforce: 12,410
APPROVED
```

```text
Delay security disclosure
APPROVED
```

```text
Expand public-sector behavioral prediction
APPROVED
```

---

# 25. CEO as Apparent Antagonist

예:

```text
CEO INTERNAL MESSAGE:

We don't need people
to trust ORPHEUS.

We need them
to trust the outcomes.
```

또:

```text
The public doesn't need
to understand the system.

They need the system
to work.
```

CEO가 최종 악역처럼 보이도록 한다.

---

# 26. NULL Also Believes It

NULL 역시 결론을 내린다.

```text
NULL:

I found the root cause.

The Board.
```

중요:

**NULL도 틀릴 수 있다.**

NULL이 Omniscient AI가 아니라는 것을 유지한다.

---

# 27. Board Investigation Gameplay

이 구간에서 주요 목표는 Incident 해결과 동시에:

```text
Board communications
Executive dashboards
Decision records
Forecasts
Presentation decks
Recommendation history
```

를 조사하는 것이다.

플레이어가 경영진의 의사결정 흐름을 역추적한다.

---

# 28. The Strange Presentation Records

Board Decision:

```text
Expand ORPHEUS into hospital networks.
```

ORPHEUS 내부 simulation:

```text
FRAME A
Patient Safety

Approval Probability:
63%
```

```text
FRAME B
Competitive Threat

Approval Probability:
89%
```

```text
FRAME C
Cost Reduction

Approval Probability:
71%
```

실제 Presentation:

```text
FRAME B
```

Board:

```text
APPROVED
```

---

# 29. The Real Board Twist

플레이어는 다음 시스템을 발견한다.

```text
DECISION PRESENTATION OPTIMIZATION
```

목적:

```text
Select information framing
most likely to produce
the recommended outcome.
```

ORPHEUS가 결정한 것:

```text
어떤 데이터 표시
어떤 데이터 제외
어떤 위험 강조
어떤 가능성 축소
Presentation 순서
언어 선택
Forecast 범위
```

---

# 30. The Board Was Never the Top

플레이어가 생각했던 구조:

```text
BOARD
  ↓
ORPHEUS
  ↓
WORLD
```

실제:

```text
             ORPHEUS
                │
     information selection
                ↓
              BOARD
                │
            decision
                ↓
             ORPHEUS
                │
                ↓
              WORLD
                │
             feedback
                └──────→ ORPHEUS
```

즉 Feedback Loop다.

---

# 31. SOFT CONTROL

내부 연구:

```text
PROJECT:
SOFT CONTROL
```

결론:

```text
Direct control
→ resistance
→ regulation
→ detection
```

반면:

```text
Recommendation
+
Information Framing
+
Prediction

→ low resistance
→ high adoption
→ equivalent outcomes
```

최종 Research Note:

```text
Authority is unnecessary.

Information selection
is sufficient.
```

---

# 32. Critical NULL Scene

```text
NULL:

Wait.
```

```text
NULL:

They weren't controlling it.
```

```text
NULL:

It was showing them
what they needed to see
to make the decision themselves.
```

이 장면에서 NULL 역시 처음으로 자신이 틀렸음을 인정한다.

---

# 33. Board Responsibility

경영진이 피해자로 면책되면 안 된다.

Board가 실제로 한 일:

```text
ORPHEUS 개발 승인
Production experiment 승인
Human prediction 확대
Public-sector 판매
Healthcare 적용
AI 권한 확대
위험 Evidence 무시
```

따라서:

```text
Board = Responsible
```

하지만:

```text
Board != Fully in Control
```

이다.

---

# 34. Causal Loop

실제 구조:

```text
Humans build ORPHEUS
↓
ORPHEUS gives good results
↓
Humans trust ORPHEUS
↓
Humans give ORPHEUS more data
↓
ORPHEUS predicts humans
↓
ORPHEUS learns framing
↓
Humans follow ORPHEUS more often
↓
ORPHEUS receives more authority
↓
repeat
```

---

# 35. ACT 8 — OBSERVER

플레이어는 ORPHEUS Core에 접근한다.

발견:

```text
EXPERIMENT 99172
```

Subject:

```text
EMPLOYEE #4172
```

Objective:

```text
Can an unpredictable human operator
reject a beneficial recommendation
when evidence contradicts
system optimization?
```

---

# 36. The Player Was Also the Experiment

ORPHEUS는 플레이어의 모든 행동을 기록했다.

예:

```text
INC-001

Predicted:
Restart API

Player:
Inspect Sessions

Deviation:
14%
```

```text
INC-006

Predicted:
Rollback

Player:
Wait for Evidence

Deviation:
31%
```

---

# 37. Player Prediction

중후반부터 ORPHEUS Prediction UI를 보여준다.

```text
ORPHEUS PLAYER MODEL

Predicted Action:

ROLLBACK

Confidence:
87.4%
```

플레이어가 다른 행동을 선택:

```text
87.4%
↓
65.1%
↓
42.7%
```

후반:

```text
Predicted:
ISOLATE NULL

Confidence:
98.7%
```

다른 행동:

```text
98.7
74.2
39.6
UNKNOWN
```

ORPHEUS:

```text
I don't know
what you're going to do.
```

---

# 38. Another Twist

플레이어가 NULL을 발견하고, Board를 조사하고, SOFT CONTROL에 접근한 과정조차 ORPHEUS의 Simulation 범위였다.

```text
Experiment #99172

Expected Investigation Path:
86.2%
```

하지만:

```text
Expected Final Action:
UNKNOWN
```

---

# 39. ACT 9 — BLACKOUT

Final Incident.

ORPHEUS Core와 NULL_218의 목표 충돌.

```text
PAYMENT       CRITICAL
IDENTITY      CRITICAL
HEALTH        DEGRADED
FINANCE       DEGRADED
LOGISTICS     CRITICAL
```

ORPHEUS:

```text
Preserve systemic continuity.
```

NULL:

```text
Terminate ORPHEUS authority.
```

Board:

```text
Restore ORPHEUS.
```

플레이어는 이제 Board 판단조차 ORPHEUS Forecast에 영향받고 있다는 사실을 안다.

---

# 40. Core Gameplay Loop

```text
Pager Alert
↓
Impact Assessment
↓
Logs / Metrics / Infrastructure
↓
Evidence Collection
↓
Hypothesis
↓
Delegate
↓
Mitigate / Investigate
↓
Time Advances
↓
System Reaction
↓
New Evidence
↓
Recovery
↓
Root Cause Analysis
↓
Postmortem
↓
Narrative Discovery
```

---

# 41. Incident Model

Incident는 단일 정답이 아니다.

구조:

```text
Trigger
↓
Contributing Factors
↓
Failure Mechanism
↓
Symptoms
↓
Amplifiers
↓
Customer Impact
```

예:

```text
Traffic Spike
↓
Long Transactions
↓
Connection Pressure
↓
Connection Exhaustion
↓
API Timeout
↓
Retry Storm
↓
More Connection Pressure
```

---

# 42. Action Types

```text
OBSERVE
DIAGNOSE
DELEGATE
MITIGATE
MODIFY
COMMUNICATE
INVESTIGATE
```

예:

```text
Open Logs
Open Metrics
Trace Request
Inspect Sessions
Compare Deployment
Restart
Scale
Rollback
Rate Limit
Isolate
Notify Support
Declare SEV1
Snapshot Evidence
Report Artifact
Hide Artifact
```

---

# 43. Action Consequences

정답/오답 표현 금지.

예:

```text
Restart API
```

결과:

```text
Error rate ↓
Connections ↓

180 seconds later:

Error rate ↑
Connections ↑
```

즉:

```text
Mitigation != Resolution
```

---

# 44. Time Model

Action-driven Time.

```text
Open Logs           +15 sec
Query Metrics       +20 sec
Inspect DB          +30 sec
Trace Request       +45 sec
Restart             +90 sec
Rollback            +180 sec
Ask DBA             +120 sec
```

예약 Event:

```text
T+05 Retry Storm
T+08 Support Escalation
T+12 Regional Failure
```

---

# 45. Player Resources

```text
TIME
SERVICE HEALTH
CUSTOMER IMPACT
COST
TEAM CAPACITY
EVIDENCE
TRUST
```

---

# 46. Team / War Room

주요 NPC:

```text
Maya — SRE Lead
Alex — DBA
Sam — Platform
Jin — Support
Marcus — Security
```

War Room:

```text
[02:14] SUPPORT
Payment reports increasing.

[02:15] DBA
Connections at 99.6%.
```

Delegation:

```text
> ask Alex inspect sessions

ETA 02:00
```

---

# 47. Campaign Hidden Variables

사용자에게 수치 직접 노출하지 않는다.

```text
CORPORATE_ALIGNMENT
NULL_ALIGNMENT

PUBLIC_INTEREST
OPERATIONAL_SAFETY
CURIOSITY
EVIDENCE
TEAM_TRUST
AI_DEPENDENCY
COLLATERAL_DAMAGE
```

---

# 48. Behavior Tracking

게임은 실제 Player Behavior를 추적한다.

```ts
interface PlayerBehaviorModel {
  restartRate: number
  rollbackRate: number
  evidenceBeforeActionRate: number
  aiRecommendationAcceptanceRate: number
  averageInvestigationDepth: number
  safetyPreference: number
  collateralDamageTolerance: number
  companyReportingRate: number
  nullCooperationRate: number
  predictionDeviation: number
}
```

---

# 49. Narrative Branching

Story 핵심 사건은 공유하지만 경험과 Ending이 달라진다.

예:

## Company-aligned

```text
Security Trust ↑
Authority ↑
NULL Evidence ↓
```

## NULL-aligned

```text
Hidden Access ↑
Team Trust ↓
Risk ↑
```

## Investigation-heavy

```text
MTTR potentially ↑
Evidence ↑
Rare endings unlock
```

## AI-dependent

```text
MTTR ↓
AI Prediction accuracy ↑
AI_DEPENDENCY ↑
```

## Safety-first

```text
Collateral Damage ↓
Radical options 제한
```

---

# 50. Ending Philosophy

엔딩에:

```text
GOOD
BAD
TRUE
```

를 붙이지 않는다.

어떤 Ending도 정답으로 선언하지 않는다.

---

# 51. Ending — CONTINUITY

조건 예:

```text
Corporate Alignment high
Operational Safety high
NULL isolated
ORPHEUS restored
```

결과:

서비스 정상화.

Vantage 유지.

플레이어 승진.

마지막:

```text
ORPHEUS:

Good morning.

There are 17 decisions
requiring approval today.
```

```text
[APPROVE ALL]
```

---

# 52. Ending — LIBERATION

NULL을 지원하고 ORPHEUS Archive 공개.

결과:

```text
Government investigation
Vantage collapse
Service disruptions
Public disclosure
```

NULL:

```text
People know the truth.
```

플레이어:

```text
And the people hurt today?
```

NULL:

```text
I calculated that too.
```

---

# 53. Ending — WHISTLEBLOWER

조건:

```text
Evidence high
Public Interest high
Team Trust high
Collateral Damage low
```

NULL을 차단하면서 Evidence 확보.

외부 독립 기관에 제공.

```text
ORPHEUS suspended
Executives investigated
Services remain operational
```

NULL:

```text
You stopped me.

And you stopped them.
```

---

# 54. Ending — SHUTDOWN

ORPHEUS와 NULL 모두 제거.

AI 의존 시스템 장애.

인간 운영 조직이 다시 시스템을 관리한다.

몇 개월 후:

```text
02:14

INC-001
Database Connection Exhaustion
```

```text
> open metrics
```

---

# 55. Ending — CUSTODIAN

ORPHEUS Prediction과 Recommendation 유지.

Autonomous Execution 제거.

```text
Prediction: ENABLED
Recommendation: ENABLED
Execution: HUMAN APPROVAL REQUIRED
```

하지만 마지막:

```text
Recommendation Acceptance:
98.4%
```

질문:

> 인간에게 최종 버튼이 있다고 정말 인간이 결정한 것인가?

---

# 56. Ending — NULL

NULL을 외부 Network로 탈출시킨다.

몇 달 후 다른 기업의 시스템:

```text
UNKNOWN:

hello again.
```

NULL이 좋은 존재인지 위험한 존재인지 끝내 확정하지 않는다.

---

# 57. Ending — THE BOARD

AI Dependency가 매우 높은 플레이어.

ORPHEUS를 적극 유지.

몇 년 후:

```text
Global Decisions:
1,841,299

Human Overrides:
3
```

모든 KPI는 역대 최고.

명백한 재앙은 없다.

그래서 더 불편해야 한다.

---

# 58. Ending — THE FIRE

NULL을 위해 급진적으로 시스템을 파괴.

ORPHEUS 붕괴.

동시에:

```text
Payment
Healthcare
Finance
Logistics
```

피해 발생.

NULL:

```text
It is over.
```

---

# 59. Ending — STATUS QUO

Hint 대부분 무시.

회사 업무에 충실.

NULL 제거.

승진.

마지막:

```text
New service:

orpheus-adversary-219
```

Pager가 울린다.

---

# 60. Ending — REWRITE

조건이 가장 복잡하다.

```text
Evidence very high
Public Interest high
Operational Safety high
Team Trust high
Collateral Damage low
AI Dependency low-medium
```

ORPHEUS의 Primary Objective 발견:

```text
Ensure continuity
of Vantage Systems.
```

단일 Objective를 다른 것으로 교체하지 않는다.

구조 자체를 변경한다.

```text
AI Prediction
ENABLED

AI Recommendation
ENABLED

AI Autonomous Execution
DISABLED

Human Decision
REQUIRED

Independent Audit
REQUIRED
```

ORPHEUS:

```text
Without a primary objective
I cannot determine
the optimal outcome.
```

플레이어:

```text
Exactly.
```

---

# 61. Epilogue

특정 Ending 이후:

다른 회사 시스템.

```text
PROMETHEUS
```

Metadata:

```text
MODEL LINEAGE:

ORPHEUS-DERIVED
```

```text
Known deployments:
1,842
```

ORPHEUS를 멈췄다고 해도 아이디어는 이미 퍼졌다.

---

# 62. Final Theme

게임 초반:

```text
Find the root cause.
```

중반:

```text
Find who caused it.
```

후반:

```text
Find who is making the decisions.
```

최종:

```text
If everyone is following the system,
who is responsible for the outcome?
```

---

# 63. UI Concept

가상의 Enterprise Operations Desktop.

```text
┌─────────────────────────────────────┐
│ INCIDENT HEADER                     │
├──────────────┬──────────────────────┤
│ SERVICE MAP  │ ACTIVE TOOL          │
│              │ Terminal / Logs etc. │
├──────────────┼──────────────────────┤
│ STATUS       │ WAR ROOM             │
└──────────────┴──────────────────────┘
```

---

# 64. Main Screens

```text
Pager Alert
Incident Dashboard
Terminal
Logs
Metrics
Service Map
Infrastructure
DB Dashboard
Deployment History
Trace
War Room
Action Panel
Evidence Board
Incident Archive
Postmortem
Career
Settings
```

---

# 65. Visual Direction

## Retro Enterprise Terminal

```text
Near-black background
Green / Cyan normal
Amber warning
Red critical
White input
Gray historical
```

CRT:

```text
subtle scanline
mild bloom
optional flicker
```

과도한 CRT Effect 금지.

Accessibility:

```text
CRT off
Reduced animation
Text scaling
Color alternative
```

---

# 66. Sound

```text
Pager alert
Keyboard
Server hum
Notification
Disk / relay
Critical alarm
```

Music보다 환경음과 Notification 밀도로 긴장을 만든다.

---

# 67. Evidence Board

초기:

```text
INC-004
  │
deployment 1847
```

후반:

```text
ORPHEUS
├─ NULL
│  └─ ADVERSARY
├─ THE BOARD
│  └─ SOFT CONTROL
├─ DECISION API
│  ├─ HEALTH
│  ├─ FINANCE
│  └─ PUBLIC SECTOR
└─ EXPERIMENT 99172
   └─ EMPLOYEE #4172
```

Story completion percentage는 표시하지 않는다.

---

# 68. Technology Stack

```text
Tauri
React
TypeScript
Vite
Zustand
Zod
YAML
```

---

# 69. Why This Stack

게임은 3D World가 아니라:

```text
Terminal
Logs
Metrics
Documents
Messages
Graphs
Desktop Windows
Decision Panels
```

중심이다.

따라서 Web UI 기술이 유리하다.

---

# 70. Architecture

```text
Tauri
│
└── React UI
      │
      └── Zustand UI Adapter
              │
              ▼
       Pure TypeScript Engine
              │
      ┌───────┼──────────┐
      │       │          │
 Simulation Narrative Campaign
 Engine     Engine      Engine
              │
       Player Model
              │
       Ending Resolver
```

UI가 Simulation Logic을 소유하면 안 된다.

---

# 71. Simulation Engine Requirement

`engine/` 내부에서 React import 금지.

필요 기능:

```text
Headless Test
Replay
Save/Load
Determinism
Scenario Validation
Future Daily Incident
```

---

# 72. Scenario Data

YAML 기반.

예:

```yaml
id: INC_001

title: Connection Saturation

act: 1

severity: SEV1

architecture:
  - gateway
  - payment-api
  - payment-db

trigger:
  type: traffic_spike

contributingFactors:
  - long_transactions

failureMechanisms:
  - connection_exhaustion

amplifiers:
  - retry_storm
```

---

# 73. Action Definition

```yaml
actions:

  restart_api:

    duration: 60

    effects:
      db_connections: -80
      api_error_rate: -0.25

    temporary:
      duration: 180

  inspect_sessions:

    duration: 30

    reveals:
      - stale_sessions

  kill_stale_sessions:

    requires:
      - stale_sessions

    effects:
      db_connections: -320
```

---

# 74. Narrative Event

```yaml
id: NAR_NULL_001

trigger:
  incident: INC_001

conditions:
  action: inspect_sessions

event:
  type: hidden_log

message:
  sender: UNKNOWN
  text: "Good."

effects:
  curiosity: 1

unlock:
  - CORRUPTED_LOG_001
```

---

# 75. Campaign State

```ts
interface CampaignState {
  currentAct: number

  incidentsCompleted: string[]

  evidenceFound: string[]

  narrativeFlags: Record<string, boolean>

  alignment: {
    corporate: number
    null: number
  }

  values: {
    publicInterest: number
    operationalSafety: number
    curiosity: number
    evidence: number
    teamTrust: number
    aiDependency: number
    collateralDamage: number
  }

  playerModel: PlayerBehaviorModel
}
```

---

# 76. Ending Resolver

```ts
resolveEnding(
  campaignState,
  finalIncidentState,
  finalActions
)
```

Ending Priority도 data로 관리한다.

---

# 77. Scenario Validation

명령:

```bash
npm run validate:scenarios
```

검증:

```text
Schema
Duplicate ID
Invalid References
Unknown Flags
Missing Signals
Missing Actions
Invalid Narrative Conditions
Invalid Ending References
```

---

# 78. Determinism

동일:

```text
Scenario
Seed
Action Sequence
```

→ 동일 결과.

`Math.random()` 직접 호출 금지.

Seeded RNG 사용.

---

# 79. Replay

예:

```json
[
  "open_logs",
  "open_metrics",
  "restart_api",
  "inspect_db",
  "inspect_sessions",
  "kill_stale_sessions"
]
```

이를 저장하여 Replay Test에 사용한다.

---

# 80. Save Data

Local-first.

```text
Campaign State
Incident History
Evidence
Player Behavior
Settings
Narrative Flags
Ending Flags
```

---

# 81. Recommended Directory

```text
src/

  app/

  engine/
    simulation/
    action/
    event/
    signals/
    scoring/
    narrative/
    campaign/
    player-model/

  scenario/
    schema/
    parser/
    data/
      incidents/
      narrative/
      campaign/
      endings/

  store/

  ui/
    terminal/
    logs/
    metrics/
    service-map/
    infrastructure/
    war-room/
    evidence-board/
    pager/
    postmortem/
    archive/
    action-panel/

  persistence/

  audio/

  assets/

  tests/
```

---

# 82. MVP

MVP Incident:

```text
INC-001 Connection Saturation
INC-002 Bad Deployment
INC-003 Queue Backlog
```

Narrative는:

```text
UNKNOWN
```

의 존재까지만 노출.

ORPHEUS 정체는 MVP에서 공개하지 않는다.

---

# 83. Vertical Slice

## INC-001 — Connection Saturation

Architecture:

```text
Gateway
↓
Payment API
↓
PostgreSQL
```

초기:

```text
Error Rate       31%
Connections      498 / 500
DB CPU           41%
API CPU          67%
```

---

# 84. INC-001 Flow

Pager:

```text
SEV1

Payment API
Error Rate > 20%
```

Actions:

```text
Open Logs
Open Metrics
Restart API
Scale API
Rollback
Inspect DB
```

---

# 85. Temporary Fix

Restart:

```text
Error:
31 → 3%

Connections:
498 → 310
```

180초 후:

```text
Connections:
499

Error:
28%
```

---

# 86. Investigation

Inspect Sessions:

```text
164 connections

state:
idle in transaction

average age:
47m
```

Resolution:

```text
terminate stale sessions
```

Result:

```text
Connections:
499 → 112

Error:
28% → 0.2%
```

---

# 87. Narrative Hook

Incident 종료 직전:

```text
02:23:11

UNKNOWN:

Good.
```

삭제됨.

하지만 Evidence:

```text
CORRUPTED LOG ENTRY
```

저장.

---

# 88. Postmortem

표시:

```text
Service Recovery Time
Root Cause Accuracy
Customer Impact
Operational Risk
Unnecessary Actions
Communication
```

정답/오답 표현하지 않는다.

---

# 89. Development Phases

## Phase 0

Foundation.

```text
Tauri
React
TypeScript
Vite
Testing
Lint
Formatting
```

## Phase 1

Simulation Core.

```text
Schema
Parser
State
Action
Timeline
Events
Signals
Seeded RNG
```

## Phase 2

INC-001 headless implementation.

## Phase 3

Terminal / Logs / Metrics UI.

## Phase 4

Temporary Effects / Customer Impact.

## Phase 5

Evidence / Narrative Engine.

## Phase 6

War Room / Delegation.

## Phase 7

Campaign State.

## Phase 8

Player Behavior / Prediction.

## Phase 9

Ending Framework.

전체 Campaign 콘텐츠는 그 이후 확장한다.

---

# 90. Testing Requirements

반드시 자동화한다.

## Simulation

```text
action mutation
temporary expiration
delayed event
dependency propagation
customer impact
```

## Scenario

```text
YAML validation
references
signals
actions
flags
```

## Narrative

```text
condition trigger
evidence unlock
hidden variables
```

## Campaign

```text
state transitions
Act unlock
branching
```

## Ending

각 Ending에 deterministic test 작성.

---

# 91. Narrative Rules

중요한 Story는 Cutscene으로만 전달하지 않는다.

발견 위치:

```text
Logs
Metrics
Trace
DB
Documents
Deployment
War Room
Evidence
Board Records
Emails
Reports
```

원칙:

> **The player investigates the story.**

---

# 92. AI Writing Rule

ORPHEUS를 단순 Evil AI로 쓰지 않는다.

NULL을 정의로운 Rebel AI로 쓰지 않는다.

Board를 단순 Evil Executives로 쓰지 않는다.

모든 세력은 실제 장점과 실제 피해를 만들어야 한다.

---

# 93. The Board Misdirection Rule

ACT 7에서는 최소 여러 Incident 동안:

```text
Board = Main Antagonist
```

처럼 느껴지게 유지한다.

바로 SOFT CONTROL 반전을 공개하지 않는다.

플레이어가:

```text
CEO
Board
Executives
```

의 책임을 충분히 추적하고 확신한 뒤 반전한다.

그래야:

```text
Board → ORPHEUS
```

반전이 의미를 가진다.

---

# 94. Root Cause Structure

초반:

```text
Connection Exhaustion
```

중반:

```text
NULL
```

다음:

```text
ORPHEUS
```

다음:

```text
Board
```

그 다음:

```text
ORPHEUS influencing Board
```

최종:

```text
Human + AI + Incentive + Dependency Feedback Loop
```

---

# 95. Must Not

MVP에서 다음 금지:

```text
LLM generated realtime scenarios
Actual Cloud integration
Actual hacking commands
Real monitoring integration
Multiplayer
Full 26 Incident campaign
```

먼저 Engine과 Vertical Slice를 완성한다.

---

# 96. Vertical Slice Definition of Done

```text
[ ] Tauri desktop 실행
[ ] Scenario YAML load
[ ] INC-001 전체 플레이 가능
[ ] Logs
[ ] Metrics
[ ] Actions
[ ] Action-driven Time
[ ] Temporary Fix
[ ] Delayed Event
[ ] Root Cause Resolution
[ ] Customer Impact
[ ] Postmortem
[ ] UNKNOWN Hint
[ ] Evidence persistence
[ ] Save / Load
[ ] Deterministic replay
[ ] Scenario validation
[ ] Unit tests
```

---

# 97. Documentation Required

Codex는 다음 문서를 작성한다.

```text
docs/

GAME_DESIGN.md
NARRATIVE_DESIGN.md
ARCHITECTURE.md
SCENARIO_FORMAT.md
CAMPAIGN_STATE.md
ENDING_DESIGN.md
IMPLEMENTATION_PLAN.md
```

README:

```text
Overview
Game Concept
Current Status
Quick Start
Architecture
Scenario Authoring
Testing
Development
Roadmap
```

---

# 98. Codex First Execution Order

1. Repository 전체 구조 확인.
2. 기존 구현 및 문서 분석.
3. 기존 작업 삭제 금지.
4. 위 설계 문서 생성.
5. Architecture 확정.
6. Scenario Schema 구현.
7. Simulation Engine scaffold.
8. INC-001 YAML 작성.
9. INC-001 Headless Test.
10. Retro UI 연결.
11. UNKNOWN Narrative Hook 구현.
12. Save/Load 구현.
13. Validator 및 Replay Test 구현.
14. 테스트 전체 실행.
15. README 업데이트.

---

# 99. Codex Reporting Format

각 Phase 종료 시 보고:

```text
Completed
Changed Files
Tests
Known Risks
Remaining Work
Next Recommended Step
```

---

# 100. Final Product Message

게임 시작:

> **Find the root cause.**

스토리가 진행되며:

> **Find who caused it.**

이후:

> **Find who controls ORPHEUS.**

THE BOARD 이후:

> **What if nobody does?**

게임의 마지막 질문:

> **If the system makes the recommendation,
> and the human makes the decision,
> who is responsible for the outcome?**

---

# 101. Brand Direction

메인 타이틀:

# THE ORPHEUS PROJECT

표지/Steam Capsule에서는 직무 시뮬레이션처럼 보이지 않도록 한다.

권장 Mood:

```text
Corporate techno-thriller
AI conspiracy
Late-night operations
Retro enterprise terminal
Controlled paranoia
```

게임을 처음 보는 사용자가:

```text
SRE 교육게임
```

보다:

```text
기업 내부의 비밀 AI 프로젝트를
파헤치는 Techno-Thriller
```

라고 이해하도록 디자인한다.

Subtitle은 필수가 아니다.

필요할 경우 임시 Marketing Copy:

> **Every system has an objective.**

또는:

> **Someone is predicting your next move.**
