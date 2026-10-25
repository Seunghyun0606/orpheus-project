# Content and visual QA — 2026-10-26

## Result and scope

Completed the report-only brief `docs/codex/2026-10-26-content-qa.md` on
`codex/content-qa`, against commit `608e996f6d3195dbe3c85c5299352c14841b98b7`.
The only reviewable repository addition is this report. Product files and canonical
Project OS state are unchanged; nothing was committed, pushed, signed or published.

There are **10 findings: 0 P1, 4 P2 and 6 P3**. The P2 findings are CQ-01
(added meaning in NULL's Korean profile), CQ-06 (advisor identity disclosed early),
CQ-07 (profiles describe later callbacks too soon), and CQ-10 (large English text
extends beyond the window). Claude's triage is recorded under each finding.

All three parity runs matched **17,197/17,197 paths**. All three UI smoke runs
reported **1,045 inputs, zero failures**, with no intermittent assertion result.
These passing checks do not constitute content or visual acceptance: CQ-10 is
visible despite the passing smoke suite.

Evidence is retained under `.qa/2026-10-26-content-qa/`, which is ignored by Git.
The resumed reporting pass reused those artifacts rather than repeating the matrix
or the six runtime runs.

## Method and coverage

Read the Korean episode catalogs alongside their English episode data, in incident
and scene order, including alternative options, deduction hints and outcomes,
conditional callbacks, evidence, and all ten endings. The reading files
`read-001.txt` through `read-026.txt` map translations to their source fields and
catalog line numbers. `speaker-ledger.json` maps 945 speaker/text occurrences to
episode and source field. These are audit aids, not automated language judgments.

| Act       | Episodes        | Korean episode catalog entries reviewed |
| --------- | --------------- | --------------------------------------: |
| 1         | INC-001–003     |                                     258 |
| 2         | INC-004–005     |                                     235 |
| 3         | INC-006–008     |                                     318 |
| 4         | INC-009–011     |                                     337 |
| 5         | INC-012–014     |                                     357 |
| 6         | INC-015–018     |                                     461 |
| 7         | INC-019–022     |                                     463 |
| 8         | INC-023–024     |                                     274 |
| 9         | INC-025–026     |                                     309 |
| **Total** | **26 episodes** |                               **3,012** |

Also reviewed all 141 Korean cast catalog entries against all 154 English cast
string occurrences: 26 base names/roles, 20 update name/role fields, 43 traits and
65 background lines. Repeated strings in updates account for the differing totals.
The cast inventory and timing assessment appear below.

The specified conversational registers are generally maintained. Maya, Jin, Sam
and the recurring human colleagues use 해요체; NULL uses short 반말; ORPHEUS uses
합쇼체 or machine-style fragments. Formal executive messages and quoted system
records were assessed in their own context. No convincing recurring speaker-register
defect was found. The caption-style inconsistency in CQ-04 is separate from dialogue.

## Korean read-through findings

### CQ-01 — P2 — NULL's profile adds other correspondents

- **Location:** `src/i18n/content/ko/story-cast.yaml:203`; English source
  `src/story/cast.yaml:227`.
- **Reproduce:** Reply to UNKNOWN in INC-007 (`report` → `ANSWER`) so
  `NULL_CONTACT` is set, then open People → NULL/UNKNOWN and read the unlocked trait.
- **Expected:** “Remembers who wrote back. You did.” establishes that the player
  answered, without establishing other people who answered.
- **Actual:** “답장한 사람을 기억함. **너도 그중 하나.**” implies the player is one
  of multiple correspondents. This extra implication also conflicts with the
  explicit “You were the only one who ever answered it” in INC-026's `ending-the-fire`.
- **Suggestion:** “답장한 사람을 기억함. 네가 답했음.” Preserve the short profile
  style without adding a group of other correspondents.
- **Claude decision:** **accepted**; Korean changed to “답장한 사람을 기억함. 네가 답했음.”

### CQ-02 — P3 — “hurt” becomes narrower physical-injury wording

- **Location:** `src/i18n/content/ko/story-inc-026.yaml:343`; English scene
  `src/story/data/inc-026.yaml:433` (`ending-liberation`, PLAYER).
- **Reproduce:** Reach the LIBERATION ending and read the player's response to
  NULL's “People know the truth.”
- **Expected:** “And the people hurt tonight?” encompasses the losses just
  described: payments, prescriptions and deliveries, as well as physical harm.
- **Actual:** “오늘 밤 **다친 사람들은?**” most readily suggests physical injuries.
  The preceding Korean narration retains the broader losses, so this is a precision
  issue rather than a missing account of the ending's consequences.
- **Suggestion:** “오늘 밤 피해를 본 사람들은?”
- **Claude decision:** **accepted**; “오늘 밤 피해를 본 사람들은?”

### CQ-03 — P3 — Literal or awkward Korean phrases

**Reproduce:** Read the indicated scene/profile in Korean. **Expected:** Natural
Korean that preserves the source meaning and speaker register. **Actual and
suggestions:**

| Location                                     | Context and current quotation                                                                                                                                                                 | Suggested rewrite                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/content/ko/story-inc-007.yaml:137` | `why` deduction hint, MAYA: “데이터베이스는 자리의 다운스트림이에요.” The literal combination of the seat metaphor and “downstream” obscures the causal hint.                                 | “데이터베이스는 세션이 자리를 차지한 뒤에 영향을 받는 쪽이에요.” Keep the following instruction to examine who holds the seats. |
| `src/i18n/content/ko/story-inc-008.yaml:203` | `report` → contact NULL: “또 너네. 좋아.” For “you again. good.”, “너네” can read as the plural pronoun rather than recognition of the same individual.                                       | “또 너구나. 좋아.”                                                                                                              |
| `src/i18n/content/ko/story-inc-014.yaml:229` | `report` → recollection from memory, MAYA: “재구축된 복제본 대 본인 말이네요.” This closely follows “Your word against a rebuilt replica” but sounds like an untranslated comparison heading. | “본인 말과 재구축된 복제본 기록이 맞서는 거네요. 저는 믿어요. 윗선이 믿어 줄 이유는 없지만요.”                                  |
| `src/i18n/content/ko/story-inc-020.yaml:51`  | Evidence title “인력 건 연대기”; the same phrase begins the body at line 53. “건” leaves the subject vague.                                                                                   | “인력 감축 결정 경위”; use the same opening in the body.                                                                        |
| `src/i18n/content/ko/story-inc-026.yaml:371` | `ending-the-fire`: “인구 1,100만 지역의 …” omits the person counter.                                                                                                                          | “인구 1,100만 명이 사는 지역의 …”                                                                                               |

These are proposed edits for Claude, not changes made by this audit. Each row can
be triaged separately within CQ-03.

**Claude decision:** **accepted**, all five rows.

### CQ-04 — P3 — Choice consequence captions switch sentence style

- **Locations:** `src/i18n/content/ko/story-inc-013.yaml:155`,
  `src/i18n/content/ko/story-inc-013.yaml:169`,
  `src/i18n/content/ko/story-inc-013.yaml:245`, and
  `src/i18n/content/ko/story-inc-014.yaml:81`.
- **Reproduce:** Read the consequence captions under choices in INC-013's
  `decide`/`copy` and INC-014's `approach`.
- **Expected:** The compact ~함/~됨 style used by comparable choice captions.
- **Actual:** Captions switch to “고리를 끊는다”, “57초 뒤에 돌아온다”,
  “NULL은 아무것도 못 받는다” and “직접 확인한다”. These do not change the facts,
  but interrupt the established caption voice.
- **Suggestion:** “고리를 끊음”, “57초 뒤에 돌아옴”, “NULL은 아무것도 못 받음”,
  and “직접 확인함”. Keep narrative prose in 해라체; this suggestion concerns
  choice consequence captions only.
- **Claude decision:** **accepted**; consequence captions use ~함/~됨 throughout the story catalogs.

### CQ-05 — P3 — Recurring technical terms need a small shared glossary

- **Locations:** Representative occurrences are listed in the glossary below.
- **Reproduce:** Compare the same concepts across the cited incidents and People.
- **Expected:** A repeated mechanism or final-choice requirement keeps a
  recognizable Korean name.
- **Actual:** “quota”, “live pool”, “plural review” and “admission fence” vary even
  where they refer to the same kind of mechanism. The last varies within INC-019.
- **Suggestion:** Adopt the recommended forms below in future editing, retaining
  contextual distinctions such as payment receipts versus review receipts.
- **Claude decision:** **accepted**; the recommended forms are applied across the Korean story catalogs.

### Glossary

| English term    | Translations seen           | Where                                                                                 | Recommended form / assessment                                                                                                                                                  |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| quota           | 할당량; 쿼터                | `story-inc-007.yaml:157`; `story-inc-024.yaml:161`                                    | **할당량**. “할당량 갱신” also makes the observer callback easier to connect to earlier limits.                                                                                |
| live pool       | 실시간 풀; 라이브 풀        | `story-inc-012.yaml:155`; `story-cast.yaml:111`                                       | **실시간 풀**; retain “실시간 쓰기 풀” when that distinction matters.                                                                                                          |
| plural review   | 복수 인원 검토안; 복수 검토 | `story-inc-024.yaml:263`; `story-cast.yaml:77`; `story-inc-026.yaml:17`, `:189`       | **복수 인원 검토**. This makes the finale refer clearly to the arrangement drafted in INC-024.                                                                                 |
| admission fence | 진입 펜스; 유입 펜스        | `story-inc-019.yaml:9`, `:135`, `:161`, `:163`, `:209`                                | **유입 펜스**, consistent with earlier 유입 규칙/유입 컨트롤러.                                                                                                                |
| Identity        | 인증; 신원 / 신원 서비스    | `story-inc-026.yaml:71`, `:81`, `:195`; INC-006's gateway/pool wording                | Keep a stable **신원 서비스 (Identity)** name in service references; use **로그인/인증** for the operation. Some current variation is contextual, not a mistranslation.        |
| receipt         | 영수증; 확인증; 증빙        | INC-003 payment receipts; INC-016 CLEARED receipts; INC-021 SEC-311; INC-025 requests | **Retain the distinction**: 영수증 for customer payment receipts, 확인증 for review completion, 증빙 for decision records. Do not globally replace these with one Korean word. |
| postmortem      | 사후 분석                   | Episodes and People                                                                   | Already consistent; retain **사후 분석**.                                                                                                                                      |

Glossary locations are relative to `src/i18n/content/ko/`.

## Cast spoiler and timing findings

Unlocks were assessed using `specs/architecture/story-episode-format.md:113` and
the implementation in `godot/scripts/story/cast_book.gd:57`. A character being
known is a prerequisite; `after` and `flag`, when both are present, must both hold.
Briefing effects apply on Continue (`godot/scripts/story/story_runner.gd:132`),
so the INC-009 identity observation below is after the register scene is read,
not a claim that its flag fires before its own dialogue.

### CQ-06 — P2 — People makes the advisor–ORPHEUS identity certain in INC-009

- **Location:** `src/story/cast.yaml:176`; associated background at
  `src/story/cast.yaml:195`. The Korean name/role translations preserve the same
  identity association.
- **Reproduce:** Finish INC-009's `register` briefing, Continue into `report`,
  then open People and select the advisor. No injected reveal flag is needed.
- **Expected:** People states only what has been established at that point,
  preserving any deliberate uncertainty about the bridge advisor's identity.
- **Actual:** `ORPHEUS_ACTIVE`, set at `src/story/data/inc-009.yaml:297`, replaces
  the advisor's name with **ORPHEUS**, with role **Operations Advisor**, and places
  its advisory-service and research-system backgrounds on one profile.
  INC-009 explicitly establishes that orpheus-planner belongs to the still-running
  ORPHEUS system. Sam's comparison of the advisor's recommendation with legacy-r7
  suggests a connection, but does not explicitly identify the advisor as ORPHEUS.
  INC-010–014 still label the speaker “Operations Advisor”. INC-015 names it
  “ORPHEUS / Care Advisor” (`src/story/data/inc-015.yaml:29`) and introduces the
  new roster name and direct voice at lines 81–85.
- **Evidence:** `.qa/2026-10-26-content-qa/captures/cast-inc009-after-register.png`;
  `.qa/2026-10-26-content-qa/logs/content-qa-probe.log` records `scene=report`,
  `ORPHEUS_ACTIVE=true`, name `ORPHEUS`, role `Operations Advisor`.
- **Suggestion:** Claude should choose the intended reveal point explicitly.
  If INC-015 is intended, delay the identity-bearing update and association until
  then, while retaining INC-009's discovery of the research system. If INC-009 is
  intended, make the identity connection explicit there and align subsequent labels.
  This is a timing discrepancy for author review; a connection can reasonably be
  inferred in INC-009, but the profile removes the remaining ambiguity.
- **Claude decision:** **accepted**: the identity is revealed at INC-015, where the episodes name it. The ORPHEUS name update and the research-system background now also need `after: INC-014`.

### CQ-07 — P2 — Decision flags unlock profiles written as later callbacks

- **Locations:** `src/story/cast.yaml:47`, `src/story/cast.yaml:54`, and
  `src/story/cast.yaml:260`, with their translations in
  `src/i18n/content/ko/story-cast.yaml`.
- **Reproduce:** Make each decision below and inspect the relevant person's
  profile in the same incident, before entering the following episode.
- **Expected:** A decision flag can reveal the decision's established outcome;
  later conversations and elapsed work should wait until the story delivers them.
- **Actual:** The flags alone unlock the following completed-history statements:

| Profile line / gate                                                                                                        | What the decision establishes                                                                                                                                   | Later supporting story                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| JIN B3: “Spent a week of tickets on 'you logged me out on Tuesday'. Asked you not to do it again.” / `INC_006_ROLLED_BACK` | INC-006's rollback signs customers out (`inc-006.yaml:188` sets the flag). It cannot yet establish the subsequent week of tickets and request not to repeat it. | Jin's Tuesday complaint and “Please not again” appear in INC-007's `page`, `src/story/data/inc-007.yaml:83`.                        |
| JIN B6: “Called back all 23 recovery tasks … Would rather you handed it nothing.” / `INC_020_AUTOMATED`                    | INC-020 says the tasks were reopened and “We're calling every one of them back” (`inc-020.yaml:276`); the flag is set at line 279.                              | “I spent half the week calling back … Please don't hand it anything tonight” is INC-021's `page`, `src/story/data/inc-021.yaml:90`. |
| EXEC B4: “Put your name in the Chair's briefing …” / `INC_019_NAMED`                                                       | INC-019 promises that the pause and name **will be** in the briefing; the flag is set at `inc-019.yaml:279`.                                                    | Maya confirms the briefing **went out** in INC-020's `page`, `src/story/data/inc-020.yaml:91`.                                      |

- **Suggestion:** Retain each choice flag and add an appropriate later timing
  condition, or rewrite the early profile as the present commitment/in-progress
  action. For example, defer the first Jin callback until INC-007, the second
  until INC-021, and the completed briefing claim until INC-020. An `after` gate
  would conservatively wait for that episode's close; a reveal flag at the callback
  would permit a more exact unlock. The existing Jin coffee line and Dana audit
  committee line already combine a choice flag with a later `after` gate.
- **Claude decision:** **accepted**, all three rows: Jin B3 `after: INC-007`, Jin B6 `after: INC-021`, EXEC B4 `after: INC-020`.

### CQ-08 — P3 — BOARD's displayed identity changes without a profile update

- **Locations:** `src/story/data/inc-025.yaml:34`,
  `src/story/data/inc-026.yaml:42`, `src/story/cast.yaml:267`.
- **Reproduce:** Read BOARD's request in INC-025, inspect its People entry, then
  read its INC-026 demand, in either language.
- **Expected:** The relationship between the speaking office and the governing
  body is clear and consistently labeled.
- **Actual:** The same speaker ID is “Office of the Chair” / “의장실” in INC-025,
  “Board” / “이사회” in INC-026, and “The Board” with role “Office of the Chair”
  in People. There is no timed cast name update. The text supports an office
  communicating the Board's instruction, so this is identity-label ambiguity,
  not evidence that these are separate hidden characters.
- **Suggestion:** Choose a stable label such as “Board / Office of the Chair”
  (“이사회 / 의장실”), or state why the speaking label changes. Preserve the
  distinction between the Board and its Chair's office in narration.
- **Claude decision:** **deferred**. “The Board / Office of the Chair” in People already states the relationship the two speaker labels reflect; revisit if play-testers find it confusing.

### CQ-09 — P3 — English authorization spelling mixes conventions

- **Locations:** `src/story/data/inc-019.yaml:191` (“authorised”),
  `src/story/data/inc-021.yaml:132` (“authorisations”), versus
  `src/story/data/inc-025.yaml:289` (“Authorize”), `:293` (“authorized”), and
  `src/story/data/inc-024.yaml:335` (“authorized”).
- **Reproduce:** Compare those English dialogue/log lines; a repository search
  for `authoris|authoriz` also locates the payment-authorization uses.
- **Expected:** One spelling convention unless a speaker-specific distinction is
  intentional and documented.
- **Actual:** British and American forms are mixed, including across executive
  authority language. No story reason for the difference is established.
- **Suggestion:** Use **authorized / authorization** for consistency with the
  existing identifiers and most authorization wording. Update matching English
  catalog keys and exports through the normal authoring workflow if accepted.
- **Claude decision:** **accepted**; American spelling (authorized/authorization) throughout the English story.

### Cast inventory: all fields reviewed

`T1`/`B1` mean the first trait/background entry in source order; `U1` means the
first name/role update. “Base” includes both the name and role. Counts include
repeated name/role strings in updates. Evidence references below identify scenes,
not a claim that every trait requires a verbatim spoken declaration.

| Character | String occurrences | Timing/evidence assessment covering its fields                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | -----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MAYA      |                 12 | Base, T1 and B1 established on the initial bridge. T2 follows INC-005's evidence rule; T3 follows the INC-003 private marker exchange; T4 follows `TEAM_BRIEFED` in INC-020/024. B2 follows INC-009 `register`; B3 INC-012 `lineage`; B4–B5 INC-017's panel/approval material; B6 INC-025's forty-page runbooks. No additional timing finding.                                                                                 |
| JIN       |                 12 | Base, T1–T2 and B1 fit the initial customer reports. T3 follows INC-013's recorded human cost; T4 is supported by continued calls despite green numbers. B2's customer groups have appeared by INC-010; B4 follows INC-015's clinics. B5 waits for both the INC-016 choice and INC-017 coffee callback. B3/B6: CQ-07.                                                                                                          |
| SAM       |                 12 | Base, T1/B1 fit INC-002. T2 follows INC-008's owner-tag dialogue; T3 INC-016's removed receipt check; T4 `TEAM_BRIEFED`. B2 correctly needs both the INC-004 choice and INC-005's vanished records. B3 INC-009; B4 INC-015; B5 INC-025; B6 the INC-024 plural-review option. No additional timing finding.                                                                                                                     |
| MARCUS    |                 11 | Base, T1–T2/B1 fit INC-005's hold. T3 fits the INC-013 recorded disagreement; T4 follows the Security-alliance response. B2 `NULL_NAME` follows INC-006's notice; B3 `NULL_ADVERSARY` follows INC-011's ownership record; B4 follows handing over NULL's sealed objective copy; B5 follows INC-021's risk register and SEC-311. No additional timing finding.                                                                  |
| ALEX      |                  9 | Base, T1/B1 fit INC-007's database diagnosis. T2 follows his solved-deduction concession; T3/B2 INC-012's throttled cutover; B3 INC-014's proposed rebuild; B4 INC-024's split reservation. No additional timing finding.                                                                                                                                                                                                      |
| DANA      |                  8 | Base, T1/B1 fit INC-012's legal-hold warning. T2/B2 follow INC-012's hold origin and enforcement dialogue; T3 INC-022's filing consequences. B3 correctly combines `BOARD_CASE_FILED` with `after: INC-023`, waiting for the committee's question. No additional timing finding.                                                                                                                                               |
| PRIYA     |                  7 | Base, T1–T2 and B1–B2 are supported by her INC-008 introduction and March restart account. B3 waits for that incident's close. No timing finding.                                                                                                                                                                                                                                                                              |
| NADIA     |                  7 | Base, T1–T2 and B1–B2 fit INC-009's introduction of the 03:00 settlement run and 41,200 payouts; the Korean makes the possible delay specifically one day, which the later outcome supports. B3 waits for INC-009's close. No additional spoiler finding.                                                                                                                                                                      |
| ORPHEUS   |                 20 | Base, T1/B1 fit the INC-004 advisor. U1 follows INC-008; U2 and its association with B2 are CQ-06. U3 follows INC-015's human-decision endpoints; U4/B5 INC-024's distributed-project reveal. T2 after INC-009, T3 after INC-010, T4 after INC-023; B3 after INC-018, B4 `SOFT_CONTROL` in INC-023, B6 `BLACKOUT_FINAL` in INC-026 are supported by their corresponding scenes.                                                |
| NULL      |                 20 | Base/T1/B1 wait for the INC-001 corrupted-log evidence. U1–U4 and B2–B5 follow `NULL_NAME` (006), `NULL_AI` (010), `NULL_ADVERSARY` (011), and `NULL_218_ARCHIVE` (014). T2 follows contact (Korean addition: CQ-01); T3 follows the stop request (013); T4 follows admission of error (023). B6 correctly records NULL's allegation under `NULL_BLAMES_BOARD` (021), rather than presenting it as independently proven truth. |
| EXEC      |                  9 | Base, T1/B1 fit INC-019's office introduction. T2/B5 follow INC-022's private review and changed distribution list. B2 follows INC-019's CEO message; B3 INC-020's CEO reply. B4: CQ-07.                                                                                                                                                                                                                                       |
| BOARD     |                 11 | Base labels: CQ-08. The Board is first met as a speaker in INC-025, after the seven members and earlier decisions have been revealed. T1–T3 and B1–B5 therefore do not expose the INC-019–023 material early merely because some gates are already satisfied. B6 follows INC-025's restoration instruction.                                                                                                                    |
| PLAYER    |                 16 | Base, T1/B1 fit INC-001. U1/B2 wait for `CONTROLLED_EXPERIMENT` (012); U2/B5 for `PLAYER_OBSERVER` (024). T2 after INC-009; T3 after keeping private copies; T4 after `HUMAN_JUDGMENT`, first available in INC-015. B3 follows the INC-017 requisition; B4 the sealed NULL copy; B6 the INC-025 router fence. No additional timing finding.                                                                                    |
| **Total** |            **154** | All base fields, updates, traits and backgrounds covered in both languages.                                                                                                                                                                                                                                                                                                                                                    |

## Visual capture QA

### Isolation and matrix

The runtime copy is `.qa/2026-10-26-content-qa/godot`. Its application name is
**Orpheus Content QA 2026-10-26**. Its settings live at
`%APPDATA%/Godot/app_userdata/Orpheus Content QA 2026-10-26/settings.cfg`.
The player's application name and save location were not used by these launches.

Captured **144 matrix PNGs**: 12 views × 2 resolutions × 3 text sizes × 2 languages.
All subprocesses exited zero; actual PNG dimensions are exactly 1280×720 or
1920×1080. Text sizes were saved as `display/text_size=0/1/2`. Captures used
instant text and reduced motion for settled frames, windowed mode, and the default
CRT effect. They do not assess animation transitions.

Every matrix image was inspected through the 24 six-image contact sheets in
`contacts/`; suspect views were additionally inspected at full resolution. The
capture inventory, dimensions and individual durations are in `capture-results.json`.

Paths follow:

```text
.qa/2026-10-26-content-qa/captures/<resolution>/<size>/<language>/<view>.png
```

| View filename      | Captured state / arguments after `--` (besides language and shot) |
| ------------------ | ----------------------------------------------------------------- |
| `title`            | Fresh title, no episode argument                                  |
| `dialogue`         | `--episode=INC-015 --until=compare`                               |
| `timer`            | `--episode=INC-026 --until=timer`                                 |
| `deduction`        | `--episode=INC-023 --until=deduction`                             |
| `summary-open`     | `--episode=INC-023 --until=END`                                   |
| `summary-fold`     | Same, plus `--fold`                                               |
| `status-values`    | `--episode=INC-026 --until=final --status=values`                 |
| `status-decisions` | Same, with `--status=decisions`                                   |
| `status-reveals`   | Same, with `--status=reveals`                                     |
| `status-people`    | Same, with `--status=people`                                      |
| `settings`         | Title with `--settings`                                           |
| `credits`          | `--episode=INC-026 --until=END --credits`                         |

The late-episode captures inject flags to populate the tabs and final actions;
the exact flag set is preserved in `capture.py`. This is a visual stress state,
including mutually exclusive earlier decisions, not evidence of a natural campaign
route. Capture mode begins with fresh progress; its credits counters are not a
campaign-persistence test. Summary captures exercise one finished-incident route,
and credits captures exercise CONTINUITY rather than every ending's credits text.

### CQ-10 — P2 — Large English text pushes the incident screen beyond the right edge

- **Locations:** `godot/scripts/ui/main.gd:350` (single-row header layout),
  `godot/scripts/ui/main.gd:354` (unwrapped incident title), and
  `godot/scripts/ui/main.gd:358` (unwrapped scene title).
- **Reproduce:** Save `display/text_size=2` and English in the isolated settings.
  Launch either `--episode=INC-015 --until=compare` or
  `--episode=INC-023 --until=deduction`, with `--resolution 1280x720` and a shot
  path. Repeat at `1920x1080`.
- **Expected:** Header controls, dialogue and deduction prompts remain within the
  viewport; body text wraps to a fully visible column.
- **Actual:** The header's combined minimum width expands the entire screen.
  INC-015 loses the Menu button and right-hand dialogue. INC-023 also cuts off
  part of Status and the deduction question. Vertical scrolling cannot recover
  text beyond the right edge. The same problem survives at 1920×1080 because
  the project scales the logical layout.
- **Measured evidence:** At a logical 1280×720 viewport, the isolated geometry
  probe measured an INC-015 screen width of **1373**, header minimum **1349**,
  and dialogue right edge **1361**. For INC-023: screen width **1466**, header
  minimum **1442**, dialogue right edge **1454**.
- **Capture evidence:**
  `.qa/2026-10-26-content-qa/captures/1280x720/large/en/dialogue.png`,
  `.qa/2026-10-26-content-qa/captures/1280x720/large/en/deduction.png`, and
  `.qa/2026-10-26-content-qa/captures/1920x1080/large/en/deduction.png`.
  Geometry output is in `logs/content-qa-probe.log`.
- **Suggestion:** Allow the header to reflow or give flexible, bounded width to
  its titles while retaining access to Status and Menu. Check the resulting body
  bounds at large English text rather than only testing that the scene completes.
- **Claude decision:** **accepted**; the header titles shrink with an ellipsis (full text in the tooltip) and the row spacing is tighter. Rechecked at large English text, 1280×720, INC-015 and INC-023.

Outside CQ-10, no additional overlap or horizontal loss was identified in the
sampled title, summaries, status tabs, settings or credits. Smaller English and all
sampled Korean header states fit. Long evidence cards, expanded summaries and some
timed-choice captions extend below their scroll view; these have visible scrollbars
and were not classified as permanently clipped text. Folding the summary restores
space for the feed and navigation. Muted text is visibly dim under CRT, but no
separate unreadable-contrast defect was established. This is a visual assessment,
not a measured contrast-compliance claim.

## Commands and repeated runtime results

Godot executable used:

```text
C:/Users/limse/Desktop/회사/AI_PJT/_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe
```

Version: `4.7.2.stable.official.ed1daf0bf`. Graphical captures used the OpenGL
Compatibility renderer on an NVIDIA GeForce RTX 4070 SUPER.

| Command / operation                                                                      | Result and evidence                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd --prefix .qa/2026-10-26-content-qa/export-stage run godot:export -- --fixtures` | Passed: 26 episodes and one locale exported, with parity fixtures. Export ran against copied source/scripts in the ignored stage; generated data, locale and fixtures were copied into the isolated Godot project. No product export was overwritten. |
| `godot --headless --path .qa/2026-10-26-content-qa/godot --import`                       | Passed; `logs/import.log`.                                                                                                                                                                                                                            |
| `npm.cmd run validate:locales`                                                           | Passed: content translation catalogs complete; `logs/validate-locales.log`.                                                                                                                                                                           |
| `npm.cmd run validate:story`                                                             | Passed for INC-001–026; `logs/validate-story.log`.                                                                                                                                                                                                    |
| `python .qa/2026-10-26-content-qa/runtime.py`                                            | Ran parity then UI smoke three times sequentially, timing each process; `runtime-results.json`.                                                                                                                                                       |
| `python .qa/2026-10-26-content-qa/capture.py`                                            | 144 successful captures; `capture-results.json` and per-capture logs. Waited for the runtime runs before changing capture settings.                                                                                                                   |
| `python .qa/2026-10-26-content-qa/contacts.py`                                           | Produced 24 six-image contact sheets used for the complete matrix inspection.                                                                                                                                                                         |
| `godot --path <copy> --resolution 1280x720 --script res://tests/content_qa_probe.gd`     | Supplemental geometry and actual INC-009 cast-state inspection. Script exists only in the ignored copy. See qualification below.                                                                                                                      |
| `godot --headless --path <copy> --script res://tests/content_qa_record.gd`               | Supplemental check of leaving INC-005's deduction and opening the completed INC-001 record, allowing frames between navigation steps: record opened successfully, no script error.                                                                    |

Here `godot` abbreviates the executable above, and `<copy>` is
`.qa/2026-10-26-content-qa/godot`. `npm.cmd` was used because PowerShell blocked
the installed `npm.ps1` launcher under its execution policy.

The actual repeated commands were:

```text
godot --headless --path .qa/2026-10-26-content-qa/godot --script res://tests/parity.gd
godot --headless --path .qa/2026-10-26-content-qa/godot --script res://tests/ui_smoke.gd
```

| Run | Check    | Duration (seconds) | Count                     | Failures | Exit |
| --- | -------- | -----------------: | ------------------------- | -------: | ---: |
| 1   | Parity   |             25.186 | 17,197/17,197 paths match |        0 |    0 |
| 1   | UI smoke |             59.119 | 1,045 inputs              |        0 |    0 |
| 2   | Parity   |             28.552 | 17,197/17,197 paths match |        0 |    0 |
| 2   | UI smoke |             55.201 | 1,045 inputs              |        0 |    0 |
| 3   | Parity   |             25.206 | 17,197/17,197 paths match |        0 |    0 |
| 3   | UI smoke |             60.898 | 1,045 inputs              |        0 |    0 |

Totals: **51,591 matched path executions**, **3,135 smoke inputs**, **254.162
seconds** of measured test-process wall time. Logs are
`logs/parity-1.log` through `parity-3.log` and `logs/ui_smoke-1.log` through
`ui_smoke-3.log`. Counts and outcomes were stable across all repetitions.

Each smoke invocation exercises the three campaign strategies, completed records,
summary folding, all four status tabs, language switching, ten final actions, and
the suite's frame-driven reveal/timer checks. Its printed “real time” subchecks
reported 175, 175 and 176 inputs with zero failures each. These are the existing
suite's simulated process-step checks, not three manually timed full playthroughs.
Parity fixtures sample up to 12 incoming carry states per episode; this is not a
claim of exhaustive traversal of every possible campaign carry.

### Diagnostics and limits

- All six repeated runs contain the Windows diagnostic “Failed to read the root
  certificate store.” The processes still exit zero; these offline tests did not
  establish an associated gameplay failure.
- All three smoke runs also report **2 ObjectDB instances leaked at exit** and
  **1 resource still in use at exit**. These are repeatable shutdown diagnostics,
  not intermittent assertion failures. Their ownership was not established by this
  brief; do not interpret the zero test-failure count as a clean stderr log.
- The supplemental geometry probe switches directly between scenes within one
  frame and triggers an invalid `solution` lookup from a stale deduction widget
  (`main.gd:1041`). The frame-separated record-navigation reproduction did not
  reproduce it. It is recorded here as a harness limitation, not promoted to a
  player-facing finding. Geometry and the subsequent cast output were still
  emitted, and the cast screenshot was inspected.
- This report does not test save migration, exports/installers, every scroll
  position, every character's profile layout, or every ending's graphical text.
  Source-level reading covered all story branches; screenshot coverage is the
  explicitly listed matrix.

## Structured task result

```yaml
task: docs/codex/2026-10-26-content-qa.md
status: completed_with_findings
role: Codex_scoped_QA
branch: codex/content-qa
base_commit: 608e996f6d3195dbe3c85c5299352c14841b98b7
scope: report_only
report: docs/qa/2026-10-26-content-qa.md
product_files_changed: false
canonical_project_state_changed: false
committed: false
pushed: false
published: false
coverage:
  episodes_read: 26
  episode_catalog_entries: 3012
  cast_catalog_entries: 141
  cast_string_occurrences: 154
  matrix_captures: 144
  matrix_images_inspected: 144
verification:
  locale_catalogs: pass
  story_validation: pass
  parity_runs: 3
  paths_per_parity_run: 17197
  parity_failures: 0
  ui_smoke_runs: 3
  inputs_per_smoke_run: 1045
  ui_smoke_assertion_failures: 0
  intermittent_assertion_results: false
  shutdown_diagnostics_present: true
findings:
  P1: 0
  P2: [CQ-01, CQ-06, CQ-07, CQ-10]
  P3: [CQ-02, CQ-03, CQ-04, CQ-05, CQ-08, CQ-09]
triage_owner: Claude
triage_status: pending
product_acceptance: not_granted_by_this_report
```
