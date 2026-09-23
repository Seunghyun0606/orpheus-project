# Operations Desktop UX

## Experience Goal

실제 엔터프라이즈 운영 도구처럼 신뢰할 수 있으면서도, 전문 SRE가 아닌 플레이어가 현재 위험과 행동 결과를 읽을 수 있는 가상의 operations desktop을 제공한다.

## Primary Layout

- 상단: Incident header, severity, 경과 시간과 핵심 영향
- 좌측: service map과 선택한 시스템의 상태
- 중앙: terminal, logs, metrics, trace, DB, deployment 등 active tool
- 하단 또는 우측: status summary, action panel과 War Room

Evidence Board, Incident Archive, Postmortem, Career와 Settings는 사건 중 workspace와 구분되는 별도 화면 또는 mode로 제공할 수 있다.

## Interaction Rules

- 플레이어는 관찰 가능한 정보와 unlock된 action만 사용한다.
- 행동 전 duration, 필요한 조건과 예상 범주는 알 수 있지만 숨겨진 정확한 결과는 미리 확정해 보여주지 않는다.
- 상태 변화는 숫자, 추세, 텍스트를 함께 사용하며 색상만으로 전달하지 않는다.
- 임시 회복과 근본 해결은 서로 다른 피드백을 제공하되 정답 배지를 사용하지 않는다.
- 중요한 Narrative artifact는 조사 도구 안에서 발견되고 Evidence Board로 연결된다.
- Story completion percentage는 표시하지 않는다.

## Visual Direction

- near-black background
- green/cyan normal, amber warning, red critical
- white input, gray historical information
- subtle scanline과 mild bloom은 기본 분위기 요소지만 정보 가독성을 우선한다.
- 과도한 왜곡, 지속적인 flicker와 읽기 어려운 bloom은 사용하지 않는다.

## Accessibility Baseline

- CRT effects off
- reduced animation
- text scaling
- color alternatives and non-color status cues
- keyboard navigation for core incident actions

## Audio Direction

Pager, keyboard, server hum, notification, relay/disk와 critical alarm을 사용한다. 음악보다 환경음과 알림 밀도로 긴장을 만들며, 중요한 상태는 소리에만 의존하지 않는다.
