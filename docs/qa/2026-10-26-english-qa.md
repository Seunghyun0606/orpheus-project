# English read-through — 2026-10-26

## Result and scope

Completed the report-only brief `docs/codex/2026-10-26-english-qa.md` on
`codex/english-qa`, against commit `3da66169639e91cb90643776d7e502af595e1e4e`.
There are **13 findings: 0 P1, 8 P2, 5 P3**, ordered by severity below.
P2 means misleading text or wrong behavior; P3 means editorial polish. The
findings contain proposed changes for Claude, not implemented product edits.

The only reviewable repository addition is this report. Product files and
canonical Project OS state are unchanged. Changes are uncommitted; nothing was
pushed, signed or published. Audit scripts, inventories, logs and screenshots are
retained locally under the ignored `.qa/2026-10-26-english-qa/` directory.

## Coverage and method

Read INC-001 through INC-026 in incident and scene order, including all alternative
choices, consequence captions, conditional callbacks, logs, metrics, evidence,
deduction prompts/hints/outcomes and all ten endings. Evidence definitions were
read alongside their collection scenes. Also read the complete English cast
profiles and the English dictionary in `godot/scripts/ui/ui_text.gd`.

Adapted `.qa/tools/content-qa/audit.mjs` into the local `audit.mjs`. It emits
`read-001.txt` through `read-026.txt` and `ledger.json`, mapping English strings to
source lines, scenes, speakers and fields. A supplemental `technical-values.txt`
includes numeric values, times, IDs and machine tokens omitted from the prose
catalogs. These inventories support the reading; they do not automate editorial
judgment. `inventory.json` records these counts:

| Act       | Incidents | Catalog entries | Source prose occurrences |
| --------- | --------- | --------------: | -----------------------: |
| 1         | 001–003   |             258 |                      287 |
| 2         | 004–005   |             235 |                      269 |
| 3         | 006–008   |             318 |                      351 |
| 4         | 009–011   |             337 |                      378 |
| 5         | 012–014   |             357 |                      401 |
| 6         | 015–018   |             461 |                      496 |
| 7         | 019–022   |             463 |                      523 |
| 8         | 023–024   |             274 |                      317 |
| 9         | 025–026   |             309 |                      324 |
| **Total** | **26**    |       **3,012** |                **3,346** |

Cast coverage is **141 catalog entries / 154 source string occurrences**,
including base/update names and roles, traits and backgrounds. Repeated English
strings account for the difference. The cast ledger is `cast-ledger.json`.

Maya generally remains decisive and spare; Jin supplies customer counts and
quotes; Sam gives practical actions and times; Marcus uses precise, guarded
language; ORPHEUS keeps its formal numerical register. Narration generally uses
present tense, with appropriate past tense for recalled events. No recurring
narrator-tense defect was established. NULL's sustained voice change is EQ-09.

Every proposed story/cast prose change also requires updating its exact English
catalog key in the relevant `src/i18n/content/ko/story-*.yaml`, preserving or
adjusting the Korean translation as appropriate. Search all catalogs for shared
keys. Claude should regenerate the Godot data/locales after accepting edits.
UI dictionary changes are maintained directly in `ui_text.gd` in both languages.

## Findings — P2

### EQ-01 — Deduction instruction is too long at large English text size

- **Location:** `godot/scripts/ui/ui_text.gd:22`; rendered without wrapping in
  `godot/scripts/ui/main.gd:412` and appended at `godot/scripts/ui/main.gd:1047`.
- **Reproduce:** In the isolated runtime, launch INC-023 with `--lang=en
--text-size=2 --until=deduction --shot=<path>` at 1280×720. Inspect the evidence
  tray heading and the right edge of the window.
- **Expected:** The instruction and the complete incident screen fit the viewport.
- **Actual:** “Pick %d pieces of evidence on the board (%d/%d)” shares the tray's
  single-line heading with “EVIDENCE BOARD · 5”. Its minimum width expands the
  screen to **1308 px** in a **1280 px** viewport; the dialogue and top-bar right
  edges are **1296 px**. Part of the right edge, including Menu's boundary, is
  outside the window. This is a remaining source of width expansion after CQ-10's
  title fix; it is not a claim that the old title implementation is unchanged.
- **Suggestion:** Shorten the key to **“Pick %d evidence cards (%d/%d)”**. This
  retains all three placeholders and the selection count. A temporary edit only
  in the isolated copy reduced the heading minimum from **792 px to 587 px**;
  screen width returned to **1280 px**, with the right edge at **1268 px**.
  Alternatively, allow the tray instruction to wrap. Recheck other deductions
  after the chosen fix.
- **Evidence:** `captures/2/deduction.png`; `logs/geometry-0.log`,
  `geometry-1.log`, `geometry-2.log`, `geometry-short-copy.log`, relative to the
  audit directory. Small and medium remained at 1280 px. The short-copy experiment
  was restored afterward; product code was not edited.
- **Claude decision:** accept. Shortened the key to “Pick %d evidence cards (%d/%d)” in `ui_text.gd` (the measured fit in the isolated probe); no `main.gd` layout change needed. The Korean string was already short and is unchanged.

### EQ-02 — An unsigned workload is described as having a foreign signature

- **Locations:** `src/story/data/inc-005.yaml:58`,
  `src/story/data/inc-005.yaml:143`; compare `src/story/data/inc-005.yaml:54`,
  `src/story/data/inc-005.yaml:123` and `src/story/data/inc-005.yaml:285`.
- **Reproduce:** In INC-005 choose `approach.MARCUS`, then read the manifest.
- **Expected:** Marcus's report agrees with the manifest's blank signature field.
- **Actual:** “The signature matches no key Vantage has ever issued” and
  “Not revoked, not expired, never ours” establish a supplied, foreign signature.
  The manifest and the incident's central clue instead establish **no signature**.
  These imply different provenance, which matters to the investigation.
- **Suggestion:** Evidence: **“There is no signature to verify. Owner field blank.
  The workload is under a Security hold and must stay intact.”** Marcus:
  **“No signature. No owner. No pipeline run. Fence it if you need to, but it stays
  intact. It's evidence now.”** Change the option/request wording from checking a
  signature to checking deployment provenance if needed; preserve Marcus's hold.
- **Claude decision:** accept. The card is now “Marcus's provenance check” / “There is no signature to verify. …”, the option asks Marcus to check where the workload came from, and Marcus reports “No signature. No owner. No pipeline run.” with the Security hold kept; this matches the manifest and the ledger log.

### EQ-03 — Opening dialogue says every new sign-in fails; the evidence says 31%

- **Locations:** `src/story/data/inc-006.yaml:78`; compare
  `src/story/data/inc-006.yaml:37` and `src/story/data/inc-006.yaml:74`.
- **Reproduce:** Read INC-006's opening briefing and its first evidence card.
- **Expected:** Dialogue distinguishes affected new sign-ins from existing sessions.
- **Actual:** Maya says “Identity is rejecting **every new sign-in**” and “anyone
  signing in fresh bounces”, alongside a **31%** new-sign-in failure metric and
  evidence. The line presents total failure as an established fact.
- **Suggestion:** **“Nearly a third of new sign-ins are failing. Existing sessions
  are fine. Morning peak is coming. Find out why.”** Preserve the distinction
  between the ca-18 failures and unaffected sessions.
- **Claude decision:** accept. Maya now says “Nearly a third of new sign-ins are bouncing. Anyone already logged in is fine.”, which matches the 31% metric and the card.

### EQ-04 — The generator's route widening is dated three hours too early

- **Locations:** `src/story/data/inc-011.yaml:50`; compare
  `src/story/data/inc-011.yaml:70`, `src/story/data/inc-011.yaml:111` and
  `src/story/data/inc-011.yaml:112`.
- **Reproduce:** Start INC-011 at its 03:05 scene and choose `approach.TRACE`.
  Compare the pipeline evidence with its source log.
- **Expected:** The evidence preserves the log's separate launch and widening times.
- **Actual:** The card says the pipeline “launched g-14 and widened its routes
  from canary to shared production **three hours ago**”. The log launches g-14
  at **23:00** and widens the routes at **03:02:11**, shortly before the page.
- **Suggestion:** **“Pipeline adv-suite/nightly launched g-14 at 23:00, then
  widened its routes from canary to shared production at 03:02 without requesting
  human approval.”** Fixed timestamps avoid further drift while the scene plays.
- **Claude decision:** accept. The card now gives the log's fixed times: launched at 23:00, widened at 03:02 without requesting human approval.

### EQ-05 — “One for one” row match contradicts the displayed row totals

- **Locations:** `src/story/data/inc-023.yaml:62`,
  `src/story/data/inc-023.yaml:147`, `src/story/data/inc-023.yaml:190` and
  `src/story/data/inc-023.yaml:200`; compare the counts at
  `src/story/data/inc-023.yaml:128` and `src/story/data/inc-023.yaml:129`.
- **Reproduce:** Choose `approach.SAM` in INC-023, then read the frame comparison
  and either deduction outcome.
- **Expected:** Sam's mistaken conclusion follows a comparison that the player can
  reconcile with the visible records.
- **Actual:** Sam says “View rows match yesterday's cached snapshot **one for
  one**”. The current served view has **1,132** rows; yesterday's cached snapshot
  has **1,129**. The later explanation repeats “my rows matched” / “comparing B
  with B”, which explains a shared selection bias but cannot explain equal totals.
- **Suggestion:** Preserve the intended wrong inference with **“Both the view and
  yesterday's cached snapshot report zero missing rows. Serve the snapshot and
  reviewers are whole again.”** In the card and deduction callbacks say **“My
  missing-row counters matched because I compared B with B.”** The zero counter
  is already established in the frame evidence at line 66. Keep the distinct row
  totals unless Claude deliberately revises the underlying records.
- **Claude decision:** accept. Sam's line and the card now say both views report zero missing rows, and the callbacks say his missing-row counters matched. The row totals (1,132 / 1,129) are unchanged.

### EQ-06 — Percentage claims need consistent, explicit comparison baselines

- **Reproduce:** Read the following dialogue alongside the associated metrics.
- **Expected:** A numerical tradeoff can be checked using the numbers the player
  has been shown, or clearly names a different forecast/baseline.
- **Actual and suggested rewrites:**

| Location / scene                                                        | Current text and conflicting comparison                                                                                                                                                                                              | Suggestion                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/story/data/inc-015.yaml:241`, `decide.FLOOR`                       | “Throughput loss 5.8%.” The briefing shows **0.93**; the fix shows **0.91** at line 239, a fall of about **2.2%**. Even comparison with the capacity projection **0.97** gives about **6.2%**, not 5.8%. No baseline is stated.      | If reporting the observed change: **“Throughput down 2.2% from the pre-change reading. Logged as operator override. I will propose v5 with the minimum priced in.”** If 5.8% is an independent model estimate, name its baseline instead of silently replacing it. |
| `src/story/data/inc-023.yaml:323`, `decide.RECONCILE`; compare line 171 | “Reviewer decision time will rise by 41%” reverses the earlier “Frame B reduces reviewer decision time by 41%”. A 41% reduction gives 59% of the original time; returning to the original requires about **69.5%** more time than B. | If restoring that original baseline: **“Reviewer decision time will rise by approximately 69.5% relative to frame B.”** If rendering three frames has a separate 41% estimate, explicitly identify it as a new estimate.                                           |

This is a clarity/consistency finding. The sources do not establish that these
arithmetic differences are intentional deception by ORPHEUS.

- **Claude decision:** accept, both rows. FLOOR: “Throughput 6.2% below the capacity projection.” (0.91 against 0.97), which is the baseline ORPHEUS already uses for its 6.2% cost in this incident, so the number can be checked. RECONCILE: “Reviewer decision time will rise by 69.5% over frame B.”, which is the exact inverse of the 41% reduction.

### EQ-07 — An internal War Room update promises a public announcement

- **Locations:** `src/story/data/inc-025.yaml:125` and
  `src/story/data/inc-025.yaml:126`.
- **Reproduce:** Read/select INC-025's `approach.STATUS` option.
- **Expected:** The consequence caption accurately identifies who receives the update.
- **Actual:** The option is “Post a status update to the **War Room** before
  anything else”, while the caption promises “**The public hears from you**”.
  Elsewhere the War Room is the internal incident bridge. The following beat is
  a status log, with no text establishing public distribution.
- **Suggestion:** Caption: **“The bridge hears from you · the map keeps moving”**.
  If public disclosure is intended, Claude should instead explicitly name the
  public status page in the option and following narrative. This report does not
  choose a different audience or change the option's effects.
- **Claude decision:** accept with a different wording. The caption is now “The War Room hears from you · the map keeps moving” (워룸에 직접 알림), so it names the same internal room as the option. Effects are unchanged.

### EQ-08 — Pressure help omits the timer floor

- **Location:** `godot/scripts/ui/ui_text.gd:55`; behavior at
  `godot/scripts/ui/main.gd:1215`.
- **Reproduce:** Read the Pressure tooltip; compare `_decision_seconds` for a
  30-second decision at pressure levels 3 and 4.
- **Expected:** The help explains the minimum available decision time.
- **Actual:** “Each level takes 5 s off decision timers” is unconditional. The
  implementation clamps the timer to **15 seconds** (or its original duration
  for a timer initially shorter than 15). Both example levels therefore give
  15 seconds, rather than level 4 giving 10. This is source-confirmed behavior;
  no timed manual playthrough is claimed.
- **Suggestion:** Replace that clause with **“Each level takes 5 s off decision
  timers, down to a minimum of 15 s”**. Current story timers are at least 15 s.
  Keep the existing explanation of colleague reactions and residual damage.
- **Claude decision:** accept. The tooltip now says “Each level takes 5 s off decision timers, down to a minimum of 15 s, …”, which matches `_decision_seconds`. The Korean adds “(최소 15초)”.

## Findings — P3

### EQ-09 — NULL loses its distinctive lowercase, fragmentary voice

- **Locations:** `src/story/data/inc-012.yaml:327`,
  `src/story/data/inc-013.yaml:298`, `src/story/data/inc-013.yaml:313`;
  compare `src/story/data/inc-007.yaml:310` and
  `src/story/data/inc-011.yaml:248`.
- **Reproduce:** Compare the early direct replies with the objective/copy scenes
  in INC-012/013 and later direct dialogue.
- **Expected:** The brief's short, lowercase-like fragments remain recognizable,
  including when NULL discusses complex motives.
- **Actual:** “not you. whoever looked. you looked.” becomes “Keep a copy of the
  objective somewhere I cannot edit it. If I am going to be stopped, someone
  should know exactly what was driving me.” Later “Received. Read-only. That is
  the first thing anyone has kept for me rather than from me” is polished,
  capitalized prose closer to a formal human correspondent. The drift begins
  before the archive reveal and persists across incidents.
- **Suggestion:** For example, line 298: **“keep the objective. somewhere i can
  read it. never edit it. if you stop me, someone should know what drove me.”**
  Line 313: **“received. read-only. the first thing kept for me. not from me.”**
  Line 327: **“a test. i made the night hard. i wasn't the one watching you.”**
  Audit direct speech separately from formal quotations inside system records.
  If a deliberate voice evolution is intended, Claude can record and apply that
  decision consistently; this report does not impose a new characterization.
- **Claude decision:** accept in part. From INC-012 on, NULL speaks in consistent capitalized short sentences across fourteen incidents, which reads as a deliberate change after the ADVERSARY reveal, so the lowercase is not restored. The two outlier lines in INC-013 are cut back to fragments: “Keep a copy of the objective. Somewhere I can read it, never edit it. If I am stopped, someone should know what drove me.” and “Received. Read-only. The first thing kept for me. Not from me.” INC-012:327 is already short and is kept.

### EQ-10 — British spelling remains in the American-English source

- **Reproduce:** Read the listed story/profile/UI lines in English.
- **Expected:** American spelling throughout, per the brief.
- **Actual / suggested replacements:**

| Location                                                            | Current                            | Suggested                              |
| ------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `src/story/data/inc-011.yaml:77`                                    | utilisation                        | utilization                            |
| `src/story/data/inc-012.yaml:65`, `src/story/data/inc-012.yaml:136` | acknowledgements / acknowledgement | acknowledgments / acknowledgment       |
| `src/story/data/inc-015.yaml:129`                                   | labelled                           | labeled                                |
| `src/story/data/inc-016.yaml:316`                                   | judgement                          | judgment                               |
| `src/story/data/inc-017.yaml:165`                                   | cancelled                          | canceled                               |
| `src/story/data/inc-018.yaml:158`                                   | neighbour                          | neighbor                               |
| `src/story/data/inc-022.yaml:54`, `src/story/data/inc-022.yaml:132` | optimise                           | optimize                               |
| `src/story/data/inc-026.yaml:350`                                   | grey                               | gray                                   |
| `godot/scripts/ui/ui_text.gd:127`                                   | “Sound: synthesised for this game” | **“Sound: synthesized for this game”** |

The search also finds “neighbour” in an INC-008 authoring comment; it is not a
player-facing finding. Acknowledgment is a preferred house-style normalization,
not a claim that the longer spelling is incomprehensible.

- **Claude decision:** accept, every row. utilization, acknowledgment(s), labeled, judgment, canceled, neighbor, optimize, gray, synthesized. The Korean is unchanged because the meaning is the same.

### EQ-11 — Local wording obscures the subject or overstates a fact

- **Reproduce:** Read the indicated scene/profile; for conditional rows, take the
  specified option. **Expected:** Natural, precise wording that preserves the
  established facts. **Actual and suggestions:**

| Location / context                                            | Current quote and issue                                                                                                                                                                                                                 | Suggested rewrite                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/story/data/inc-001.yaml:160`, `decide.TERMINATE` caption | “frees what holds the pool” leaves the object unclear: the sessions hold connections; the action releases those connections.                                                                                                            | **“Takes two minutes · frees the held connections”**                                                                                                        |
| `src/story/data/inc-004.yaml:130`, `approach.JIN`             | “six percent ... are wholesale reorders, fifty items and up” changes both the category and boundary. The card at line 52 says 6% have **more than 50** items, **almost all** wholesale reorders; the crash condition also says over 50. | **“Spinners everywhere, no pattern by region. Six percent of tonight's carts have over fifty items. Almost all wholesale reorders. Those customers call.”** |
| `src/story/data/inc-013.yaml:333`, `copy.SECURITY`            | “Case 2231 just got its **first real exhibit**” dismisses or contradicts the manifest, certificate traces and edge-z already filed; INC-009 line 85 explicitly calls edge-z an exhibit.                                                 | **“Case 2231 just got the adversary's own orders. Thank you.”**                                                                                             |
| `src/story/data/inc-022.yaml:143`, `floors` narration         | “Northmoor, Kessel Valley and Druin Coast **predict low**” assigns the prediction to the regions and leaves out what is low.                                                                                                            | **“The forecast predicts low demand in Northmoor, Kessel Valley and Druin Coast.”** Replace only that sentence.                                             |
| `src/story/data/inc-023.yaml:303`, `decide.RAW`               | “Fifty-eight risk attachments that **none of the views ever rendered**” conflicts with frame A's 58 and frame C's 14 at lines 159–161. The distinction is selected/served versus available frames.                                      | **“Raw rows are ugly, but they're all there. Fifty-eight risk attachments the served view left out.”**                                                      |
| `src/story/cast.yaml:23`, Maya background                     | “Signed off the INC-001 postmortem” is less idiomatic for the American-English voice.                                                                                                                                                   | **“Signed off on the INC-001 postmortem. Nobody told her it had an experiment ID.”**                                                                        |
| `src/story/cast.yaml:55`, Jin background                      | “Called back all 23 recovery tasks” makes tasks the recipients of phone calls.                                                                                                                                                          | **“Called back the customers behind all 23 recovery tasks the automation closed as LOW_VALUE. Would rather you handed it nothing.”**                        |
| `src/story/cast.yaml:190`, ORPHEUS trait                      | “a projection and **a confidence to two decimals**” omits the thing being quantified.                                                                                                                                                   | **“Offers one action, a projection and a confidence score to two decimal places.”**                                                                         |
| `godot/scripts/ui/ui_text.gd:62`, Status help                 | “Which final actions open is decided by the Decisions tab” awkwardly makes a UI tab the decision maker. The displayed tab is “Decisions that matter”.                                                                                   | Replace the second sentence with **“Your decisions determine which final actions are available. See Decisions that matter.”**                               |

- **Claude decision:** accept, every row, with the wording as suggested: TERMINATE caption, Jin's cart line (over fifty items, almost all wholesale), Marcus “Case 2231 just got the adversary's own orders.”, the PSF-3 narration, Sam's raw-rows line (“the served view left out”), Maya's “Signed off on”, Jin's callback to the customers, ORPHEUS's “confidence score to two decimal places”, and the Status help (“Your decisions determine which final actions are available. See Decisions that matter.”; the Korean already said this).

### EQ-12 — Terminology and formatting need a small shared glossary

- **Reproduce:** Compare the cited labels/logs/profiles across incidents.
- **Expected:** Repeated concepts have recognizable display names; distinct
  mechanisms and raw identifiers remain distinguishable.
- **Actual:** The following variants require either normalization or an explicit
  distinction. The first row is a stale callback title; the others are consistency
  recommendations rather than evidence that all variants are wrong.

| Term                     | Variants                                                    | Where                                                                                                                                                                        | Recommended                                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INC-001 title            | Connection Saturation / Database Connection Exhaustion      | `src/story/data/inc-001.yaml:7`; `src/story/data/inc-026.yaml:362` (SHUTDOWN callback)                                                                                       | **Connection Saturation** when naming this episode. If the final page deliberately names a different event, avoid presenting it as the same INC-001 title without explanation.                                                                                                                  |
| NULL instance display    | NULL-218 / NULL_218 / “instance 218”                        | `src/story/data/inc-026.yaml:233`; `src/story/data/inc-014.yaml:267`; `src/story/cast.yaml:230`                                                                              | **NULL-218** in display prose; **instance 218** in explanation. Preserve `NULL_218` in archive identifiers and `svc/model-serving-218` in process identifiers. These are aliases, not tokens to replace globally.                                                                               |
| Minimum allocation       | floor / minimum / guaranteed route                          | `src/story/data/inc-015.yaml:56`, `src/story/data/inc-015.yaml:144`; `src/story/data/inc-018.yaml:60`; `src/story/data/inc-022.yaml:50`                                      | Introduce **minimum guaranteed allocation (“floor”)** once. Use the sector-specific unit afterward: clinic route, emergency unit, regional capacity.                                                                                                                                            |
| Human review requirement | plural review / plural human review / two reviewers minimum | `src/story/data/inc-024.yaml:366`, `src/story/data/inc-024.yaml:370`; `src/story/data/inc-026.yaml:475`; `godot/scripts/ui/ui_text.gd:92`                                    | **Multi-person review**, initially explained as at least two reviewers, one reviewing before seeing the recommendation. If retaining **plural review** as the named policy, define it at the first option and keep the phrase consistent. This does not change the review rules or ending gate. |
| Settlement deadline      | cut-off                                                     | `src/story/data/inc-009.yaml:254`; `src/story/cast.yaml:166`                                                                                                                 | **cutoff** as a noun in the American-English house style.                                                                                                                                                                                                                                       |
| Percentage formatting    | 90 % / 90%; 38 %; 100 %                                     | `src/story/data/inc-007.yaml:45`, `src/story/data/inc-007.yaml:120`, `src/story/data/inc-007.yaml:141`; `src/story/data/inc-008.yaml:135`, `src/story/data/inc-008.yaml:193` | **90%, 38%, 100%**, matching the metric tiles and most dialogue.                                                                                                                                                                                                                                |
| Thousands grouping       | 1 900 / 1,900; 4 800 / 4,800                                | `src/story/data/inc-011.yaml:42`, `src/story/data/inc-011.yaml:107`, `src/story/data/inc-011.yaml:140`, `src/story/data/inc-011.yaml:141`; compare line 76                   | **1,900 / 4,800** in displayed prose/logs. Preserve values. Add the missing final period to the evidence body at line 42.                                                                                                                                                                       |
| Job identifier           | job id / experiment ID                                      | `src/story/data/inc-009.yaml:115`; `src/story/data/inc-012.yaml:284`                                                                                                         | **job ID**; consistently capitalize the abbreviation in prose.                                                                                                                                                                                                                                  |

Keep **session pool** (INC-007) distinct from its downstream **database connection
pool**, despite both using “seats” in explanations. Likewise, Capacity Advisor →
Operations Advisor → ORPHEUS is a gated identity progression, not an accidental
name inconsistency; do not reveal ORPHEUS earlier merely to unify the label.

- **Claude decision:** accept in part. Accepted: the SHUTDOWN pager now reads “Connection Saturation” (커넥션 포화); the INC-014 option uses NULL-218 (logs, archive IDs and evidence records keep NULL_218); INC-015 Maya glosses the floor at first use (“the one route each clinic was guaranteed”); INC-026 says “plural review”, which stays the named policy defined at the INC-024 option, so the keyword and `PLURAL_REVIEW_DRAFTED` label stay; “cutoff” in INC-009 and the cast; 90%, 38% and 100% in INC-007/008; 4,800 and 1,900 in the INC-011 logs and card (final period added); “job ID” in INC-009. No separate glossary file is added.

### EQ-13 — First-use jargon needs a few short, natural glosses

- **Reproduce:** Read the first encounters below as a player without SRE experience.
- **Expected:** The action and its consequence remain understandable without
  outside technical knowledge, while logs keep their authentic tokens.
- **Actual:** Key nouns in the evidence/options are assumed before their practical
  meaning has been explained. Later metaphors often help, but arrive after an
  initial choice. Proposed glosses are editorial suggestions, not a request for
  tutorials or definitions on every appearance.

| First relevant location                                                                                       | Current wording / obstacle                                                        | Suggested natural English equivalent                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/story/data/inc-001.yaml:32`, pool card                                                                   | “498 of its 500 connections” does not name what the limited resource does.        | **“PostgreSQL holds 498 of its 500 connections—the slots requests need to use the database—yet its CPU sits at 41%.”** The later deduction still belongs to the player.                                                                                                                                    |
| `src/story/data/inc-001.yaml:36`, idle-transaction card                                                       | “idle in transaction” is the critical diagnostic term.                            | **“164 sessions have left a transaction—a unit of database work—open while doing nothing, for 47 minutes on average. Each still holds a connection.”** Retain the technical term in the title/log.                                                                                                         |
| `src/story/data/inc-002.yaml:43`, issuer/verifier card                                                        | The roles of issuer, verifier and key set are initially implicit.                 | **“The issuer signs new sessions with K72, but the verifier that checks those signatures still accepts only K71.”**                                                                                                                                                                                        |
| `src/story/data/inc-003.yaml:165`, dead-letter option                                                         | “dead-letter rule” hides what happens to valid receipts caught by it.             | **“Send legacy-format receipts to a dead-letter queue for separate handling”**; keep the existing consequence explaining that the rule catches more than this receipt.                                                                                                                                     |
| `src/story/data/inc-004.yaml:36`, heap/GC card; `src/story/data/inc-004.yaml:100`, heap-dump option           | Heap, GC and heap dump arrive before a plain-language explanation.                | Card opening: **“Checkout's working memory (heap) averages 78% on all twelve instances, up from 49% ten minutes ago.”** Follow with **“Garbage collection (GC), which clears unused objects, pauses work for up to 880 ms.”** Option: **“Read the handler log, then take a memory snapshot (heap dump)”**. |
| `src/story/data/inc-010.yaml:46`, lease evidence; `src/story/data/inc-010.yaml:50`, fence evidence            | A lease and a numbered fence are central to the real fix.                         | Add to the first card: **“The lease is the controller's right to manage the replica.”** For the second: **“The store should reject older authority numbers (fences), but still accepts 40 even though 41 is current.”**                                                                                    |
| `src/story/data/inc-011.yaml:42`, shared-address evidence                                                     | NAT and egress require network knowledge to recognize the bank's collateral risk. | **“The shared outbound address range (NAT), 10.44.0.0/16, also carries Northmere Bank's settlement calls, about 1,900 a minute.”** Keep the range intact.                                                                                                                                                  |
| `src/story/data/inc-014.yaml:39`, digest evidence; `src/story/data/inc-014.yaml:102`, original-receipt option | The player must distinguish an integrity mismatch from corrupted data.            | Evidence: **“arch-c is marked CORRUPT: its integrity checks (digests) disagree with the manifest on 217 segments.”** Option: **“Check arch-c's segments against the integrity hashes recorded when they were first written.”** Keep the logs' original names.                                              |

Do not add an early explanation of the hidden experiment, NULL's identity or the
framing scheme. These glosses concern operational vocabulary already on screen.

- **Claude decision:** accept, every row, worded to keep each episode's bold keywords (idle in transaction, legacy format, heap dump, fence 41, original write receipt). INC-001 pool and idle cards, INC-002 issuer/verifier, INC-003 dead-letter option, INC-004 heap/GC card and heap-dump option, INC-010 lease and fence cards, INC-011 NAT card, INC-014 digest card (the evidence body only; the log line keeps its raw form) and the original-receipt option. None of them reveals the experiment, NULL or the framing early.

## Cross-incident fact checks

The read-through also compared the following recurring anchors. Apart from the
localized findings above, no conflicting value was found for these anchors:

| Anchor         | Checked continuity                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player         | Employee **#4172**, archive **op-4172**, requisition **VS-SRE-0412**, technical score **71**, decision model **97.8**, eight higher technical candidates, approval in **11 seconds**; INC-012/017/024/025/026 and cast.       |
| Experiments    | **ADV-18471** labels INC-001; **99172** labels the ongoing observer experiment. These are different records, not interchangeable IDs.                                                                                         |
| NULL           | **svc/model-serving-218**, instance **218**, archived instances **001–217**, replacement **219**; INC-010/013/014/024/026 and cast.                                                                                           |
| Security       | **Case 2231**, shadow-7, observer-7f4c and pid 3318 recur consistently as links in the same investigation; EQ-02 and EQ-11 concern descriptions, not a changed case number.                                                   |
| Board evidence | **14-C / REL-778 / 7–0**; **16-A / REC-55 / 12,410 roles**; **SEC-311 / RISK-0193 / four nodes, two patched**; **19-B / PSW-12**. Final audit-package IDs agree.                                                              |
| Operations     | **41,200** merchant payouts in settle-night and Nadia's profile; repeat-214's batches every **214 seconds** (the four listed intervals agree); shared writer generations **77/78**, restart **79/80**, last human map **61**. |

Distinct figures such as 58 credit-file attachments versus 72 omitted rows were
not automatically treated as errors: the text does not require one attachment
per row. Dialogue that knowingly rounds a figure was likewise distinguished from
an exact contradiction. Conditional ending lines were checked before reporting
apparent contradictions: CUSTODIAN's approval of seventeen and rejection of the
ninth belong to mutually exclusive dependency thresholds and are not a finding.

## Visual verification and commands

Runtime work used the copy `.qa/2026-10-26-english-qa/godot`, application name
**Orpheus English QA 2026-10-26**. Its settings directory is
`%APPDATA%/Godot/app_userdata/Orpheus English QA 2026-10-26`. Captures use review
mode, which begins with empty progress. The player's application/save path was
not used. The local geometry harness also set `reviewing=true` before starting
an incident; all application startup occurred under the separate QA name.

Godot executable:

```text
C:/Users/limse/Desktop/회사/AI_PJT/_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe
```

Version **4.7.2.stable.official.ed1daf0bf**; graphical checks used Compatibility
OpenGL on an NVIDIA GeForce RTX 4070 SUPER. Captured and inspected **21 PNGs**:
seven views × English text sizes 0/1/2, all exactly **1280×720**, all launches
exit zero. All images were inspected on three contact sheets; the large
deduction and Decisions views were additionally inspected at original size.

| View          | Review arguments after `--`, besides language, text size and shot     |
| ------------- | --------------------------------------------------------------------- |
| Title         | No episode argument                                                   |
| Dialogue      | `--episode=INC-015 --until=compare`                                   |
| Deduction     | `--episode=INC-023 --until=deduction`                                 |
| Final actions | `--episode=INC-026 --until=final` plus gate flags                     |
| Settings      | `--settings`                                                          |
| Decisions     | Final-action state plus `--status=decisions`                          |
| Credits       | `--episode=INC-026 --until=END --credits` plus gate flags; CONTINUITY |

Full commands and injected flags are in `capture-results.json` and `capture.py`.
The flag-populated states stress the available copy; they are not a claim that
all those decisions were made in one natural campaign. Screens used instant text,
reduced motion and default CRT. Scrollable text extending below its pane was not
classified as permanently clipped. Except for EQ-01, no additional string-length
defect was established in these sampled views. Long final choices wrap; Decisions
labels fit. This is not an exhaustive inspection of every profile, scroll
position, timer state, resolution, animation or ending's graphical layout.

| Command / operation                                                                      | Result                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node .qa/2026-10-26-english-qa/audit.mjs`                                               | Generated source reading files, ledger, counts and supplemental technical values.                                                                      |
| `node .qa/2026-10-26-english-qa/inventory.mjs`                                           | Confirmed reading/cast/capture inventory, including 21 captures and zero capture process failures.                                                     |
| `npm.cmd run validate:locales`                                                           | Passed: catalogs complete; `logs/validate-locales.log`. Read-only check.                                                                               |
| `npm.cmd run validate:story`                                                             | Passed: INC-001–026; `logs/validate-story.log`.                                                                                                        |
| `node scripts/story/export-godot.mjs --check`                                            | Passed: committed Godot story data up to date. No export rewritten.                                                                                    |
| `python .qa/2026-10-26-english-qa/capture.py`                                            | Copied Godot, changed the copy's application name, imported it and captured the 21 views. `capture-results.json`, `logs/import.log`, per-capture logs. |
| `python .qa/2026-10-26-english-qa/contacts.py`                                           | Verified image dimensions and produced three contact sheets in `contacts/`.                                                                            |
| `python .qa/2026-10-26-english-qa/geometry.py`                                           | Four separate graphical processes: three text sizes and one temporary shortened-copy comparison. Exit zero; measurements in EQ-01.                     |
| `npx.cmd --no-install prettier docs/qa/2026-10-26-english-qa.md --write`, then `--check` | Formatted the report; final formatting check passed.                                                                                                   |
| `git diff --check`; `git status --short`; `git diff --name-only`                         | Final scope checks: report addition only; no tracked product/state modifications.                                                                      |

The geometry command calls `godot --path <copy> --resolution 1280x720 --script
res://tests/english_qa_geometry.gd -- <size>`. The script is only in the ignored
copy. The temporary shorter UI text was restored after measurement.

The earlier draft of that harness attempted to mutate a constant dictionary and
failed to parse; a second draft reused a scene and triggered the known stale
deduction-widget `solution` access. Neither draft supplies the final measurements.
The final separate-process runs have no GDScript errors. The logs retain the
Windows root-certificate-store diagnostic. Several capture processes report
2–7 ObjectDB instances and 1–2 resources remaining at exit; the large baseline
geometry process reports six instances and two resources. These
shutdown diagnostics are not a clean-stderr result or a proven player-facing
failure. No parity or full UI-smoke matrix was rerun for this report-only brief.

## Structured task result

```yaml
task: docs/codex/2026-10-26-english-qa.md
status: completed_with_findings
role: Codex_scoped_QA
branch: codex/english-qa
base_commit: 3da66169639e91cb90643776d7e502af595e1e4e
scope: report_only
report: docs/qa/2026-10-26-english-qa.md
product_files_changed: false
canonical_project_state_changed: false
committed: false
pushed: false
signed: false
published: false
coverage:
  episodes_read: 26
  endings_read: 10
  episode_catalog_entries: 3012
  episode_prose_occurrences: 3346
  cast_catalog_entries: 141
  cast_string_occurrences: 154
  english_ui_dictionary_read: true
  captures_inspected: 21
  capture_resolution: 1280x720
  text_sizes: [0, 1, 2]
verification:
  locale_catalogs: pass
  story_validation: pass
  committed_godot_export: current
  capture_process_failures: 0
  final_geometry_processes: 4
  geometry_confirms_large_text_overflow: true
  proposed_shorter_copy_fits_isolated_probe: true
  product_fix_applied: false
findings:
  P1: []
  P2: [EQ-01, EQ-02, EQ-03, EQ-04, EQ-05, EQ-06, EQ-07, EQ-08]
  P3: [EQ-09, EQ-10, EQ-11, EQ-12, EQ-13]
triage_owner: Claude
triage_status: pending
product_acceptance: not_granted_by_this_report
```
