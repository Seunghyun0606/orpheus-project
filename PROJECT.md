# The Orpheus Project

## Vision

기술 장애 대응의 긴장감과 기업 음모 수사를 결합한 싱글플레이 내러티브 테크노 스릴러를 만든다. 플레이어는 시스템의 근본 원인을 찾는 엔지니어로 출발하지만, 신뢰받는 AI 추천과 인간의 자발적 선택이 결합될 때 누가 결과에 책임지는지를 추적하게 된다.

## Target User

- 로그, 지표, 문서와 메시지를 직접 조사하며 이야기를 발견하는 플레이를 좋아하는 사람
- 시간과 피해, 증거와 신뢰 사이의 불완전한 선택을 즐기는 내러티브·수사·전략 게임 플레이어
- 기술적 분위기에는 끌리지만 실제 SRE 경험이나 전문 지식이 반드시 필요하지 않은 데스크톱 게임 플레이어

이 제품은 SRE 교육 도구보다 기업 내부의 비밀 AI 시스템을 파헤치는 테크노 스릴러로 인식되어야 한다.

## Core Experience

플레이어는 Vantage Systems의 Production Reliability Engineer로서 Pager 호출을 받고, 로그·지표·인프라·동료의 정보를 조사하고, 제한된 시간 안에 완화와 원인 규명 사이의 결정을 내린다. 행동은 시간을 진행시키고 시스템과 조직의 반응을 바꾸며, 그 결과로 새로운 증거와 서사가 열린다.

핵심 경험은 다음의 반복이다.

`장애 인지 → 영향 평가 → 관찰과 가설 → 조치 또는 위임 → 시스템 반응 → 복구 → 사후 분석 → 서사 발견`

플레이어의 선택은 단순한 정답·오답이 아니라 서비스 안정성, 고객 피해, 증거, 신뢰와 이후 선택지를 함께 바꾼다. 캠페인은 선택지 문구보다 실제 행동 습관을 추적해 경험과 결말에 반영한다.

## Product Principles

- **The player investigates the story.** 중요한 서사는 컷신만이 아니라 로그, 지표, 배포 기록, 문서, 메시지와 증거를 통해 발견한다.
- **Mitigation is not resolution.** 즉시 수치를 개선하는 행동과 근본 원인을 해결하는 행동을 구분하고, 결과를 정답·오답으로 표시하지 않는다.
- **Optimization is not judgment.** 효율적인 추천과 책임 있는 판단이 항상 같지 않다는 긴장을 유지한다.
- **No simple villain, no true ending.** ORPHEUS, NULL, 경영진 모두 실제 효용과 실제 피해를 만들며 어느 결말도 공식 정답으로 선언하지 않는다.
- **Content is data; engines execute it.** Incident, Narrative, Evidence, Campaign, Ending은 데이터로 정의하고 UI에 하드코딩하지 않는다.
- **Simulation is deterministic and UI-independent.** 동일한 시나리오·시드·행동 순서는 동일한 결과를 만들며 핵심 엔진은 React 없이 헤드리스로 검증할 수 있어야 한다.
- **Technical authenticity must remain legible.** 운영 도구의 감각은 살리되 실제 전문 지식 없이도 관찰, 추론, 결과의 인과를 이해할 수 있어야 한다.
- **Atmosphere must not defeat accessibility.** 레트로 엔터프라이즈 터미널 분위기를 유지하되 CRT 효과, 애니메이션, 글자 크기와 색상 표현을 조절할 수 있어야 한다.

## Non-Goals

현재 제품 단계에서는 다음을 목표로 하지 않는다.

- 실시간 LLM 생성 시나리오
- 실제 Cloud, 모니터링 또는 운영 시스템 연동
- 실제 침입이나 해킹 명령을 재현하는 기능
- 멀티플레이
- 3D 월드 또는 액션 중심 게임플레이
- SRE 자격 평가나 직무 교육 제품
- 첫 MVP에서 9개 Act 전체 또는 24~28개 Incident 전체 구현
- 첫 MVP에서 ORPHEUS의 정체와 후반 반전 공개

## Success Definition

현재 단계의 성공은 `INC-001 Connection Saturation` 수직 슬라이스가 데스크톱에서 처음부터 사후 분석까지 플레이 가능하고, 다음을 함께 증명하는 것이다.

- 데이터로 작성한 시나리오를 검증하고 로드할 수 있다.
- 행동 기반 시간, 임시 완화, 지연 이벤트, 근본 원인 해결과 고객 피해가 일관되게 작동한다.
- 동일한 시드와 행동 기록을 재생하면 동일한 결과가 나온다.
- 저장·불러오기 후에도 Incident, Evidence와 Narrative 상태가 보존된다.
- 플레이어가 `UNKNOWN`의 흔적을 조사로 발견하고 증거로 남길 수 있다.
- 새 Incident와 Narrative를 React 로직 변경 없이 추가할 수 있는 경계가 확인된다.
- 자동화된 시나리오 검증과 핵심 엔진 테스트가 통과한다.
