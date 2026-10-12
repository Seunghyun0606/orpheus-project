# Approved full-campaign content blueprint

Human-approved content baseline under
[DEC-038](../../.project-os/decisions/DEC-038-approved-full-campaign-blueprint.yaml),
2026-10-12. This is a content specification, not implemented playable content,
production schema/version selection, task acceptance or release approval.

The exact approved Incident identities, causal sketches, contrasting paths,
investigation surfaces and reveal graph are the
[frozen candidate](../../.project-os/planning/TASK-026.campaign-blueprint.yaml)
at commit `cbdeba0`. Retain its bytes and historical pending-status strings;
DEC-038 records their subsequent approval rather than rewriting that checkpoint.
The [inventory and rationale](../../docs/TASK-026_CAMPAIGN_BLUEPRINT.md) distinguishes
approved content from unimplemented architecture, balance and release choices.

## Approved allocation

26 total Incidents: existing INC-001–003 plus 23 new Incidents.

| Act            | Incident IDs | Count |
| -------------- | ------------ | ----- |
| 1 NORMAL       | INC-001–003  | 3     |
| 2 GHOST        | INC-004–005  | 2     |
| 3 NULL         | INC-006–008  | 3     |
| 4 ORPHEUS      | INC-009–011  | 3     |
| 5 EXPERIMENT   | INC-012–014  | 3     |
| 6 HUMAN SYSTEM | INC-015–018  | 4     |
| 7 THE BOARD    | INC-019–022  | 4     |
| 8 OBSERVER     | INC-023–024  | 2     |
| 9 BLACKOUT     | INC-025–026  | 2     |

Memory Leak is INC-004 in Act 2, outside the three-Incident MVP. Existing
INC-001 Connection Saturation 1.1.0, INC-002 Bad Deployment 1.2.0 and INC-003
Queue Backlog 1.2.0 remain unchanged. Frozen legacy replay remains authoritative.

All 19 reveal nodes and their prerequisites are approved. In particular, NULL's
name, AI identity and company ADVERSARY origin remain distinct discoveries.
Board investigation spans INC-019–022; SOFT CONTROL resolution and NULL's admission
of error follow at INC-023. The Board remains responsible after the framing reveal.

The prerequisite graph describes the investigation-heavy route, not forced story
disclosure for every ending. Main recovery/Act access must not require every optional
clue or an unavailable metric. Later investigations need accessible authored
re-investigation paths without fabricating exposure, history or effects. The final
BLACKOUT context is verified independently of optional full-disclosure routes.

## Boundaries still awaiting decisions and verification

- New immutable content/model/definition versions and production entry/catalog policy.
- Authored investigation view representation and any material schema extension.
- Production opportunity/rate classification, initial values and ending balance.
- Conditional epilogue implementation, supported targets, budgets, licensed audio,
  packaging/signing/distribution and final release decision.
- TASK-026 independent review, document QA and distinct Project OS evaluation now
  PASS source candidate `66a019f`, with committed evidence `10ccb59`. TASK-027 has
  been claimed but requires its own concrete composition approval. M4/TASK-024/025
  verification remains mandatory before final M5 acceptance/release under DEC-037.
