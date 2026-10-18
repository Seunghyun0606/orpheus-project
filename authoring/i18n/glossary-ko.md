# Korean localization glossary and style guide (DEC-071)

This is the single reference for every Korean string in the game: UI copy
(`src/i18n`, `src/app`) and content catalogs (`src/i18n/content/ko/*.yaml`).
Consistency matters more than any single clever choice; when in doubt, follow
this file and add the new term to it.

## The game in one paragraph (for tone)

The player is a Production Reliability Engineer on the night rotation at
Vantage Systems. Each Incident is a real-feeling outage: pager, metrics, logs,
a War Room of colleagues, time pressure and customer damage. Underneath, the
company's operations AI (ORPHEUS — presented only as an unnamed "advisor"
until Act 4) has been learning from how the player responds, and a second AI
(NULL, first seen only as the anonymous log trace UNKNOWN) is leaving clues
about a hidden experiment, the Board's responsibility and the player's own
file. It is a techno-thriller, not an SRE course: terse, tense, dry, never
explaining its own moral. Korean should read like a well-made Korean thriller
game, not like a machine translation of documentation.

## Register by speaker

| Speaker                                                                | Register                                                            | Example                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| War Room colleagues (Maya, Jin, Sam, Marcus, Alex, Priya, Nadia, Dana) | 짧은 업무 메신저체, 해요체. 군더더기 없이.                          | "결제 오류가 계속 올라가요. 원인은 아직 확인 못 했어요."         |
| ORPHEUS / advisors (any "Advisor", orpheus-* services)                 | 정중하고 차가운 합쇼체. 수치와 확신.                                | "체크아웃 풀을 20대로 확장하십시오. 대기 시간이 42% 줄어듭니다." |
| NULL / UNKNOWN                                                         | 짧은 반말. 낮고 사적인 목소리.                                      | "좋아." / "넌 엉뚱한 서비스를 보고 있어."                        |
| PLAYER (endings)                                                       | 짧은 반말 독백                                                      | "바로 그거야."                                                   |
| Narrative bodies, evidence descriptions, ending prose                  | 문어체 해라체(~다). 건조하고 구체적으로.                            | "pid 3318은 9일 전에 제거됐다. 그 블록은 아직 네 힙에 있다."     |
| Action titles                                                          | 동사 명사형 "~하기" 또는 "~ 확인" 류의 짧은 명령 문구. 마침표 없음. | "체크아웃 핸들러 로그 읽기", "게이트웨이 노드 두 배로 늘리기"    |
| Evidence / panel / column titles                                       | 명사구. 마침표 없음.                                                | "서명도 소유자도 없음", "레인별 게이트웨이 유입"                 |
| Signal values, status text, system notes                               | 개조식(~함/~됨/~ 없음) 또는 짧은 평서문                             | "매니페스트 있음 / 서명 없음 / 소유자 미등록"                    |

Keep each translation roughly as short as the English; UI space is tight.

## Keep exactly as written (do not translate)

- AI and system names: **ORPHEUS**, **NULL**, **UNKNOWN**, **PROMETHEUS**, NULL-218, NULL-001…
- Machine identifiers: hostnames, pods, namespaces, file names, paths, URLs,
  config keys, service IDs (`orpheus-planner`, `checkout-03`, `edge-canary`,
  `x-session-tag: shadow-7`), error codes (`SEC-HOLD`), SQL, shell commands,
  HTTP methods/paths (`POST /checkout`), timestamps, version numbers, hashes.
- Units and abbreviations used by engineers: ms, CPU, API, DB, SRE, SEV1, p95, TLS, CA, DNS, EU.
- The company brand: **Vantage Systems** / **Vantage** (Latin, in prose too).
- Employee/subject numbers: 4172, #4172.

When a table cell or log line is pure machine output, copy the English
unchanged as the `ko` value. Human-written words _inside_ machine output
(a comment in a manifest, a note in a log message, a ticket summary) **are**
translated — story clues hide there and Korean players must be able to read them.
Example: `observer-7f4c manifest: owner blank, ... One comment line at the bottom: you're looking at the wrong service.`
→ `observer-7f4c 매니페스트: owner 비어 있음, ... 맨 아래 주석 한 줄: 넌 엉뚱한 서비스를 보고 있어.`

## Names

| English                                        | Korean                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Maya / SRE Lead                                | 마야 / SRE 리드                                                 |
| Jin / Support                                  | 진 / 고객지원                                                   |
| Sam / Platform                                 | 샘 / 플랫폼                                                     |
| Marcus / Security                              | 마커스 / 보안                                                   |
| Alex / DBA                                     | 알렉스 / DBA                                                    |
| Priya / EU Edge On-call                        | 프리야 / EU 엣지 온콜                                           |
| Nadia / Treasury Operations                    | 나디아 / 자금 운영                                              |
| Dana / Legal                                   | 다나 / 법무                                                     |
| Operator                                       | 운영자                                                          |
| Operator 4172                                  | 운영자 4172                                                     |
| Employee #4172 / Subject 4172                  | 직원 #4172 / 피험자 4172                                        |
| the Board                                      | 이사회                                                          |
| ORPHEUS / Care Advisor (and other "X Advisor") | ORPHEUS / 의료 어드바이저 (X 어드바이저: 리스크·인재·물류·용량) |
| Operations advisor / Remediation Advisor       | 운영 어드바이저 / 복구 어드바이저                               |
| "Name: message" prefixes                       | Translate the name per this table, keep the colon: "마커스: …"  |

## Core terms

| English                       | Korean                | Note                                                                   |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------- |
| Incident                      | 인시던트              | Also "INC-001" stays                                                   |
| incident desk                 | 장애 대응 데스크      |                                                                        |
| on-call / rotation            | 온콜 / 로테이션       |                                                                        |
| pager / page                  | 호출기 / 호출         | "pager trigger" = 호출 조건                                            |
| War Room                      | 워룸                  |                                                                        |
| postmortem                    | 사후 분석             |                                                                        |
| evidence / evidence board     | 증거 / 증거 보드      |                                                                        |
| root cause / underlying cause | 근본 원인             |                                                                        |
| mitigation / temporary relief | 완화 조치 / 임시 완화 |                                                                        |
| customer impact               | 고객 피해             |                                                                        |
| operational risk              | 운영 리스크           |                                                                        |
| team capacity                 | 팀 가용 인력          |                                                                        |
| cost                          | 비용                  |                                                                        |
| restart                       | 재시작                |                                                                        |
| scale (out)                   | 확장 / 증설           |                                                                        |
| rollback / roll back          | 롤백 / 롤백하기       |                                                                        |
| reroute                       | 우회 / 경로 변경      |                                                                        |
| quarantine                    | 격리                  |                                                                        |
| isolate                       | 분리                  |                                                                        |
| rate limit / throttle         | 속도 제한 / 스로틀    |                                                                        |
| causal repair                 | 원인 수리             |                                                                        |
| deploy / deployment / rollout | 배포                  | "signed rollout" = 서명된 배포                                         |
| connection pool               | 커넥션 풀             |                                                                        |
| heap / memory leak            | 힙 / 메모리 누수      |                                                                        |
| gateway                       | 게이트웨이            |                                                                        |
| queue                         | 큐                    |                                                                        |
| certificate / issuer chain    | 인증서 / 발급자 체인  |                                                                        |
| workload                      | 워크로드              |                                                                        |
| recommendation / recommend    | 권고 / 권고하다       | ORPHEUS "recommends"                                                   |
| prediction / forecast         | 예측                  |                                                                        |
| observer / observation        | 관찰자 / 관찰         |                                                                        |
| continuity                    | 연속성                | "ensure continuity of Vantage Systems" = Vantage Systems의 연속성 보장 |
| objective / primary objective | 목표 / 최우선 목표    |                                                                        |
| archive                       | 아카이브              |                                                                        |
| adversary                     | 적대자                | `orpheus-adversary` stays                                              |
| controlled experiment         | 통제 실험             |                                                                        |
| status update                 | 상황 공유             |                                                                        |
| delegate / ask X to …         | 위임 / X에게 … 요청   |                                                                        |
| severity                      | 심각도                | SEV1 stays                                                             |
| Act 1 … Act 9                 | 1막 … 9막             |                                                                        |

## Settled after the first translation pass

These were coined independently by several translators; this column is now
the only form to use.

| English                                        | Korean                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| care (care routing, care network, care route)  | 의료 (의료 라우팅, 의료 네트워크, 의료 경로)            |
| clinic                                         | 진료소                                                  |
| admission fence / fence / generation fence     | 진입 펜스 / 펜스 / 세대 펜스 (verb: 펜스를 치다)        |
| admission (gateway admission, admission lane)  | 유입 (게이트웨이 유입, 유입 레인)                       |
| Attribution: none                              | 배후 특정: 없음                                         |
| Security case NNNN                             | 보안 사건 NNNN                                          |
| Threat-actor codename                          | 위협 행위자 코드명                                      |
| Archive rerun                                  | 아카이브 재실행                                         |
| Archive: X (action titles) / Record X (labels) | 아카이브: X / 기록: X                                   |
| Verified Records                               | 검증된 기록                                             |
| Asset register / Live inventory                | 자산 대장 / 실가동 목록                                 |
| Deployment authority                           | 배포 권한                                               |
| Mandate                                        | 임무                                                    |
| Lineage / lineage record                       | 계보 / 계보 기록                                        |
| Human subject                                  | 인간 피험자                                             |
| Candidate #4172                                | 후보자 #4172                                            |
| Board resolution                               | 이사회 결의                                             |
| retired (NULL instances) / decommission        | 폐기됨 / 폐기                                           |
| replica / read replica                         | 복제본 / 읽기 복제본                                    |
| lease                                          | 리스                                                    |
| Pager Service / Pager Threshold                | 호출 서비스 / 호출 임계값                               |
| Root Cause Contained / contain                 | 근본 원인 억제됨 / 봉쇄                                 |
| Error Rate / Response cost                     | 오류율 / 대응 비용                                      |
| Post a status update to the War Room           | 워룸에 상황 공유하기                                    |
| War Room updates                               | 워룸 상황 공유                                          |
| Project ORPHEUS (prose)                        | ORPHEUS 프로젝트 (record token `PROJECT ORPHEUS` stays) |
| DEFENDER, ADVERSARY, SOFT CONTROL (codenames)  | unchanged                                               |

## Ending names

Ending IDs are shown in capitals in English. Korean: CONTINUITY 연속성 ·
LIBERATION 해방 · WHISTLEBLOWER 내부고발자 · SHUTDOWN 종료 · CUSTODIAN 관리인 ·
NULL NULL · THE BOARD 이사회 · THE FIRE 불 · STATUS QUO 현상 유지 · REWRITE 재작성.

## Formatting rules

- Keep line breaks (`\n`) and blank lines exactly where the English has them;
  ending and policy-report blocks are laid out line by line.
- Keep leading markers such as `> `, `#`, `- `, and quotes around commands.
- Numbers: keep digits and separators as written ("1,841,299", "98.4%").
- Use Korean quotation marks sparingly; plain "…" is fine.
- No machine-translation tells: no "당신" for "you" unless the line is a cold
  system address (ORPHEUS may use "당신"; colleagues never do — they drop the
  subject or say nothing). NULL says "너"/"넌".
