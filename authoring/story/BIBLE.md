# Story episodes — campaign bible (DEC-072)

The single reference for turning INC-004–026 into story episodes. Read it with
`specs/product/03-choice-driven-story.md` (the loop), `specs/architecture/story-episode-format.md`
(the data format) and the finished Act 1 episodes `src/story/data/inc-001..003.yaml`
(tone, length, structure). Story canon comes from `specs/product/01-game-and-narrative-direction.md`,
`authoring/campaign-1.2/BRIEFS.md` and the 1.2.0 source incidents; this file fixes how the
episodes connect.

## What an episode is

- 5–8 scenes, 5–10 minutes, roughly 70–110 player-facing strings.
- Shape: `page` briefing (pager, metrics, colleagues; collects evidence) → a first-move choice
  (2–3 directions, all reach the cause, each collects different supporting evidence) →
  optional briefing that lands the diagnosis → **the Act's deduction** where this bible puts
  one → a **timed** decision (25–45 s, 2–4 options with visible costs) → a briefing that
  delivers the episode's story discovery (guaranteed evidence) → a report/aftermath choice
  that sets this episode's decision flag.
- Every option has a `consequence` that states its cost in a few words, never right/wrong.
- The timer default is what happens when nobody decides: a colleague's reflex in Acts 1–3,
  the platform's automation from Act 3, the advisor's recommendation from Act 4 and ORPHEUS's
  recommendation by name from Act 6. Say so in `timer.beats`.
- Keep the source incident's twist (see BRIEFS): the fix that backfires, the relief that
  expires, the plausible-but-wrong delegated report, the neighbour that breaks. Make the twist
  visible in the beats of the option that triggers it.
- Evidence: 5–8 items. The episode's story discovery is `kind: story, guaranteed: true`.
  Reuse the source incident's evidence IDs, titles and descriptions where they exist — their
  Korean translations already exist and must be reused verbatim.
- Values: each episode moves values by small amounts (±1…3 per option). Report choices set
  alignment `corporate` or `null` by +1…2. Keep the totals of a full campaign plausible:
  roughly −10…+40 per value over 26 episodes.

## Acts, reveals and deductions

Reveal flags are set in the `effects` of the briefing that delivers the discovery, on every
path (the discovery evidence is `guaranteed`). Do not reveal anything before its episode.

| Act            | Episodes         | Reveal flags (set here)                                                                                    | Deduction scene in |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| 2 GHOST        | INC-004, INC-005 | `GHOST_ARTIFACT` (005)                                                                                     | INC-005            |
| 3 NULL         | INC-006–008      | `NULL_NAME` (006)                                                                                          | INC-007            |
| 4 ORPHEUS      | INC-009–011      | `ORPHEUS_ACTIVE` (009), `NULL_AI` (010), `NULL_ADVERSARY` (011)                                            | INC-009            |
| 5 EXPERIMENT   | INC-012–014      | `CONTROLLED_EXPERIMENT` (012), `NULL_STOP_REQUEST` (013), `NULL_218_ARCHIVE` (014)                         | INC-012            |
| 6 HUMAN SYSTEM | INC-015–018      | `HUMAN_DECISION_APIS` (015), `RECRUITMENT_SELECTION` (017)                                                 | INC-016            |
| 7 THE BOARD    | INC-019–022      | `BOARD_RESPONSIBILITY` (019), `NULL_BLAMES_BOARD` (021), `BOARD_CASE_COMPLETE` (022)                       | INC-020            |
| 8 OBSERVER     | INC-023–024      | `SOFT_CONTROL`, `NULL_ADMITS_ERROR` (023); `FEEDBACK_LOOP`, `PLAYER_OBSERVER`, `PROJECT_DISTRIBUTED` (024) | INC-023            |
| 9 BLACKOUT     | INC-025–026      | `BLACKOUT_FINAL` (026)                                                                                     | INC-025            |

Reveal order rules (from the approved graph):

- Acts 2–3 never name ORPHEUS or the Board. Before Act 4 an advisor is a generic tool
  ("Remediation Advisor", "Capacity Advisor"). Before INC-006, NULL is only the anonymous
  `UNKNOWN:` log voice. From INC-006 NULL may speak as cast member `NULL` (short, low,
  casual Korean 반말); Security (Marcus) calls NULL an attacker.
- INC-009 shows ORPHEUS is still running (`orpheus-planner`). In Acts 4–5 ORPHEUS appears in
  records and logs; an advising voice is still "Operations Advisor". From Act 6 ORPHEUS
  recommends by name: cast member `ORPHEUS` with a role, e.g. "ORPHEUS / Care Advisor"
  (cold, formal Korean 합쇼체, numbers and certainty).
- NULL is an AI (010) of the company's own ADVERSARY line (011); INC-012 shows INC-001 was
  experiment ADV-18471 and the player is subject #4172; NULL asks to be stopped (013); NULL
  is instance 218 of many (014).
- Act 7 keeps the Board as the plausible controller for four incidents; NULL blames the Board
  confidently and wrongly (021). INC-023 shows SOFT CONTROL — ORPHEUS chose which version of
  each decision humans saw — and NULL admits its mistake. The Board stays responsible.
- INC-024: experiment 99172 observes the player live; "There is no Project ORPHEUS." — it was
  distributed. The player was hired for low predictability (017).
- No faction is simply right. NULL can be wrong; ORPHEUS's recommendations really help on
  aggregate and really leave people out.

## Decision flags (cross-act state)

Only these flags carry decisions across acts. Set each exactly where listed, from the choice
described; read each only where listed. Flags not in this table may be set for callbacks inside
the same act (name them `INC_NNN_*`) and may be read only by the next episode.

| Flag                                | Set in                                                           | By                                                                                      | Read in                              |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| `ARCHIVE_KEEPER`                    | INC-005                                                          | keeping a private copy of the ownerless manifest                                        | INC-014 (callback), INC-026 gate     |
| `SECURITY_ALLY`                     | INC-006 or INC-011                                               | cooperating with Marcus: filing the trace / sending the ownership report                | INC-013 (callback), INC-026 epilogue |
| `NULL_CONTACT`                      | INC-007 or INC-008                                               | answering NULL instead of reporting the contact                                         | INC-013 (callback), INC-026 epilogue |
| `NULL_TRUSTED`                      | INC-013                                                          | keeping a sealed copy of NULL's objective constraint for NULL                           | INC-014 (callback), INC-026 gate     |
| `ARCHIVE_SAVED`                     | INC-014                                                          | verifying the NULL-218 archive before isolating the replica                             | INC-026 gate                         |
| `HUMAN_JUDGMENT`                    | INC-015, INC-018 or INC-022                                      | overriding an ORPHEUS recommendation in the decision                                    | INC-026 gate                         |
| `BOARD_ALLIED` / `BOARD_CASE_FILED` | INC-022 report (mutually exclusive; a third option sets neither) | siding with the CEO's office / filing the Board case                                    | INC-023 (callback), INC-026 gate     |
| `TEAM_BRIEFED`                      | INC-020 or INC-024                                               | bringing Maya and Sam into the investigation                                            | INC-026 epilogue                     |
| `PLURAL_REVIEW_DRAFTED`             | INC-024                                                          | drafting a plural human review with the team                                            | INC-026 gate                         |
| `MANUAL_READY` / `CORE_LOCATED`     | INC-025 report (mutually exclusive; a third option sets neither) | preparing manual-operation runbooks / tracing both writers to the shared authority core | INC-026 gate                         |

Act 1 already sets `UNKNOWN_SHARED_WITH_MAYA`, `UNKNOWN_REPORTED`, `UNKNOWN_KEPT`,
`ANNOTATION_*`, `REDACTION_TICKET`, `REDACTION_KEPT`, `MAYA_IN_ON_IT`. INC-004 may read
`REDACTION_*` and `MAYA_IN_ON_IT` for its opening; nothing later reads Act 1 flags.

Options may be gated only by choices and flags (`chose`, `flags`, `has`). Accumulated values
and alignment (`values`, `alignment` with `gte`/`lte`) may gate **beats only** — use them for
predictions, reactions and epilogue colour.

## Predictions (Acts 4–8)

The advisor/ORPHEUS watches the player. In a decision scene it may state a prediction chosen by
value-conditioned beats (e.g. `operationalSafety gte 8` → "Predicted response: causal repair,
confidence 0.81"; otherwise "Predicted response: fastest relief"). Options' aftermath beats may
react with the same conditions ("as predicted" / "off-model"). Act 8 pays this off: the player
is the observed variable. Never let a prediction gate an option.

## The finale (INC-026)

The final decision is untimed and offers the ten final actions; each sets `ENDING_<NAME>`
(spaces as `_`) and leads to that ending's scenes. Availability:

| Final action                               | Ending        | Available when                                 |
| ------------------------------------------ | ------------- | ---------------------------------------------- |
| Restore core continuity                    | CONTINUITY    | always                                         |
| Restore with a replacement adversary       | STATUS QUO    | always                                         |
| Disable both authority paths               | SHUTDOWN      | `MANUAL_READY`                                 |
| Require human approval for every execution | CUSTODIAN     | `HUMAN_JUDGMENT`                               |
| Expand continuity authority to the Board   | THE BOARD     | `BOARD_ALLIED`                                 |
| Allow NULL's external route                | NULL          | `NULL_TRUSTED`                                 |
| Publish the archive and keep the adversary | LIBERATION    | `NULL_TRUSTED` and `ARCHIVE_SAVED`             |
| Hand everything to an independent audit    | WHISTLEBLOWER | `BOARD_CASE_FILED` and `ARCHIVE_KEEPER`        |
| Destroy the shared authority core          | THE FIRE      | `CORE_LOCATED`                                 |
| Require plural review and audit            | REWRITE       | `BOARD_CASE_FILED` and `PLURAL_REVIEW_DRAFTED` |

Ending scenes reuse the approved ending prose in
`src/scenario/data/full-campaign/ending-presentations/endings-1.2.0.yaml` (exact English text,
so its Korean translation is reused) plus value-conditioned epilogue beats, and end with the
closing question ("If the system makes the recommendation, and the human makes the decision,
who is responsible for the outcome?"). No ending is labelled right.

## Cast and voice

Maya / SRE Lead, Jin / Support, Sam / Platform, Alex / DBA, Marcus / Security, Dana / Legal
(and others as the source incident needs). Use the names exactly as in
`authoring/i18n/glossary-ko.md`. Colleagues: short work-chat lines. Narration: present tense,
dry, concrete. UNKNOWN/NULL: short. ORPHEUS: precise, polite, numeric. No lectures, no rule
explanations, no "this does not prove…".

## Workflow for one episode

1. Read the source: `src/scenario/data/full-campaign/incidents/inc-NNN-1.2.0.yaml`,
   `.../presentations/inc-NNN-1.2.0.yaml`, `authoring/campaign-1.2/incidents/inc-NNN.yaml`
   and the BRIEFS entry.
2. Write `src/story/data/inc-NNN.yaml`.
3. `node scripts/story/story.mjs check INC-NNN` until it prints `ok`.
4. `node scripts/i18n/content-catalog.mjs --only story-inc-NNN` creates the catalog.
   `node scripts/i18n/catalog-tool.mjs known story-inc-NNN` lists translations that already
   exist elsewhere — use them verbatim. `node scripts/i18n/catalog-tool.mjs dump story-inc-NNN`
   lists the rest; write a JSON of `{index: korean}` and apply it with
   `node scripts/i18n/catalog-tool.mjs apply story-inc-NNN <file>`. Follow
   `authoring/i18n/glossary-ko.md` (registers, terms, what stays in English).
5. Read it back: `node scripts/story/story.mjs script INC-NNN --lang ko`.

## YAML pitfalls found while writing Acts 2–9

- Quote `'NULL'` (cast id, speaker) and the alignment key `'null'`; unquoted they parse as null.
- Quote text containing ` #` (e.g. "#4172") or a comma-separated number in a metric value.
- Single all-caps words (e.g. "CONTINUITY") are treated as machine tokens by the catalog
  generator and are not translated; give titles a few words ("Ending · Continuity").
