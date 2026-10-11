# Campaign definition interfaces — approved logical contract

## TASK-022 implementation checkpoint

DEC-030 pins optional `branches` and `prediction` in new immutable campaign definition
versions only. Absence preserves older authorities and exact replay record shapes;
adding or changing a model in an existing authority is rejected by whole-record replay.
There is no connection/migration operation, latest-version fallback or new storage field.

Each branch has a unique `id`, the campaign `version`, and explicit typed `eligibility`
and `reveal` trees. `getCampaignBranches` verifies the official record before evaluating
both trees with strict registered campaign observations, including evidence, flags,
hidden values and available behavior. Results grant no route/effect and diagnose
unavailable leaves even behind an unmet reveal. They are internal tool/test results,
not player-facing hidden-value disclosures.

The optional predictor declares exact model/classification/formula versions, comparable
contexts, stable candidates, minimum support and explicit coverage for every allowed
content version. Supported mappings validate typed references, context/reveal predicates,
action IDs and candidate eligibility. Unsupported historical coverage diagnoses rather
than claiming a complete empirical model. [Prediction schema and boundary details](player-prediction.md)
describe the headless candidate. Its samples share immutable version metadata in the
result header and retain their individual pre-command context and source identities.

No opportunity, actual exposure acknowledgement or response variant is implemented by
this checkpoint. Querying results cannot provide recommendation acceptance or prediction
deviation observations. No production mappings, UI, old-save rewrite or native verification
were introduced. [TASK-022](../../docs/TASK-022_IMPLEMENTATION.md) remains a developer
implementation with final independent review/QA and distinct evaluation PASS under
DEC-031. Project OS completed the bounded task on 2026-10-11.

DEC-031 explicitly assigns actual prediction presentation acknowledgement, eligible
responses and positive deviation/failure/recovery fixtures to TASK-024 and their
independent integration/native audit to TASK-025. TASK-022 is evaluated for pure
queries only; no exposure obligation is waived or represented as passing. The
actual-presentation and response contracts below remain mandatory before M4 completion.

## TASK-021 implementation checkpoint

DEC-026 accepted the logical baseline and DEC-029 approves immutable behavior binding
only in new campaign definition versions. The optional `behavior` representation is
implemented in `src/scenario/behavior.ts`; absent data leaves older authorities and
records unchanged. Schema/formula version 1 supports explicit action classifications,
immediate/uniquely attributable timer observations, required relevance/freshness
conditions and strict registered pre-action context. No opportunity/exposure variants,
production mappings, automatic model attachment or storage migration are introduced.
See [candidate and limitations](../../docs/TASK-021_IMPLEMENTATION.md). Independent
TASK-021 review/QA passed final candidate `895a05b`; a distinct evaluator accepted
the evidence and Project OS completed TASK-021 on 2026-10-11.

The original draft wording below is retained as the logical baseline/history; its
pending TASK-018 review language is superseded by DEC-026, not by developer self-approval.

## Original logical baseline

This is a proposed logical authoring contract under DEC-001/003/009–025, not a
runtime schema or production content. Exact field spellings may be translated
to TypeScript/Zod without changing these semantics. A supported version resolves
to immutable validated data; unknown versions never resolve to the latest data.

## Typed condition tree and reference registry

A condition definition has an explicit ID/version and one tagged tree:

- `all`: a nonempty `children` list of conditions.
- `any`: a nonempty `children` list of conditions.
- `not`: exactly one `child` condition.
- `compare`: a registered typed `reference`, `operator` and typed `expected` value.

Comparison operators are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`. Ordered comparisons
require finite numbers; booleans and declared string/enumeration values allow
only equality/inequality with the same type. Unknown operators, mixed types,
nonfinite values and undeclared references diagnose. Do not coerce strings,
round metric values before comparison, or evaluate executable expressions.

Each registry entry identifies its namespace/key, value type, definition version
and allowed evaluation context. Namespaces cover Act, completed-incident/evidence
membership, narrative/ending flags, alignment/hidden values, behavior metrics and
explicit registered scenario/final-action/context observations. A definition must
declare references to the relevant scenario/model/flag/evidence catalog; no
arbitrary object path, property lookup, UI callback or inferred action label is
allowed. A final-action observation additionally needs its validated final-attempt
context; a pre-action observation cannot read future final results.

The context distinguishes available typed values from valid unavailable values
with coverage/reason/provenance. Malformed absent required context is diagnostic,
not an empty collection or default false. For a declared authoritative membership
collection, verified absence is known false; missing collection authority is not.
An unsupported or unknown registry entry is not an available observation.
All ten behavior fields retain their own approved sample counts/availability.

The [strict condition contract](condition-evaluation.md) governs every tree:
validate all references and require all referenced observations before composition.
Expose context/definition/reference diagnostics to tools without raw hidden values
or story-completion percentages in player UI. Registry and tree versions are part
of replay authority, not interchangeable with physical database versions.

## Campaign and behavior definitions

Campaign data explicitly supplies definition version, initial Act, allowed
incidents/Acts, initial alignment/hidden values and flags/membership, transition
conditions and stable authored effect IDs/deltas. Required initial numeric values
are finite authored inputs, not invented zeros or production tuning in this doc.
References and any authored ranges must validate; no implicit clamping occurs.
Act/incident eligibility is a condition tree, not incident-ID code. Completion
effects require verified new completion events under DEC-012/015; a completed
legacy checkpoint cannot grant official progression.

Behavior data supplies an ID/version and scenario-version-specific classifications:
operational intervention, restart/rollback subsets, investigation source/result
rules and stable investigation keys. Validate numerator subset relationships.
Investigation support for evidence-before-action has required `relevance` and
`freshness` conditions evaluated at the intervention's pre-action boundary over
earlier new same-attempt observations. Both must be explicit; neither missing
freshness nor prior membership establishes permanent valid support. Current
simulation elapsed time or verified state can be registered as authored context;
wall-clock time and unrecorded information cannot supply freshness.

Investigation results retain their new accepted source input and returned-result
boundary. Pending requests are not observations; inherited delegation outcomes
cannot become new investigation merely by arriving during a later command.
Distinct investigation keys remain per-attempt under DEC-018; numeric effect
receipts remain per-run under DEC-015. Classification, key, relevance and freshness
changes need explicit compatible definitions, not reinterpretation of old inputs.

## Opportunities and response association

Versioned opportunity data declares ID, kind, applicable metric, actual information
or presentation requirements, availability and continuing-validity conditions,
eligible response identities/conditions and the metric's positive/matching rule.
Recommendation/prediction kinds additionally retain the exposed action/result,
candidate availability and historical calculation boundary. Reporting/cooperation
and preference definitions must declare the known pre-action choice information;
old UNKNOWN text is not such a declaration. Missing mandatory rules diagnose.

No global timeout, permanent-validity or latest-opportunity-wins default exists.
Any expiry, replacement or continuing-validity rule is explicit versioned authored
data using verified context. Replacement must identify its authorized predecessor
and rule; a new display does not silently supersede another opportunity. Reuse
cannot reopen an already-consumed response identity. Expiry/no response adds no
positive or negative sample. Production rule values remain unselected.

Before a new accepted choice, validate current opportunity and response eligibility
against the verified pre-action state. Association records the opportunity ID,
metric and source input. A uniquely applicable validated opportunity can match a
manually executed action without an accept button. Ambiguous overlapping applicable
opportunities diagnose unless a validated authored association rule uniquely
resolves them; never infer a choice by timestamp, display order or caller preference.
Zero applicable valid opportunities adds no response sample, not a rejection;
invalid required definitions/context remain diagnostics, not zero applicability.

At most one response is consumed per identified recommendation/prediction/reporting/
cooperation opportunity for its metric. Preference reuse/consumption must also be
explicitly authored; every observation still deduplicates source input per metric.
Distinct metrics require their own valid contexts, not copied observations. One
operational command/cost is retained once even when independently qualifying for
more than one metric. No classification automatically grants alignment/effects.

## Actual presentation and durable response eligibility

The adapter can prepare a result without treating it as an exposure. Its logical
record retains result/context/history/definition identity, separate from an actual
presentation acknowledgement. The acknowledgement identifies the prepared result,
attempt and verified presentation/gate context and occurs after actual presentation,
before any qualifying response. A computation, hidden panel, archive replay or
queued render cannot acknowledge visibility. The adapter must substantiate its
acknowledgement with integration/native tests; this is not proof of human attention
or a security/authentication guarantee.

The acknowledged opportunity and identity must be committed under DEC-013 before
the adapter accepts a qualifying official response against it. Persisting a prepared
result alone cannot create a sample. Until acknowledgement is committed, a proposed
response cannot be acknowledged as an official sample; the adapter surfaces pending
or failure rather than guessing exposure or adding an acceptance/rejection. Commit
failure preserves prior official state, including previously valid opportunities.
Presentation can have happened before a failed commit; do not claim the player did
not see it. Reconcile/retry its stable acknowledgement identity without redisplay
creating another opportunity. Exact-head resume preserves identities; a new
checkpoint baseline cannot turn inherited presentations into new samples.

Physical rendering/acknowledgement order and lost-ack recovery need TASK-020/024/025
verification separately from pure response matching. No DOM/IndexedDB atomicity is
promised. Lifecycle rules remain authored, not imposed by this recording boundary.

## Ending precedence representation

Each ending has a unique ID, recorded definition version, condition tree and
`priorityRank`: a nonnegative safe integer, where a smaller rank is preferred.
This is the representation of authored precedence, not a production ordering of
the ten endings; no ranks for production IDs are assigned here. Equal ranks are
valid and can create the top tie required by DEC-019; neither filename nor ID
breaks a tie. Validate all requested definitions, references and context, including
lower-ranked conditions. Any diagnostic condition prevents manufacturing a winner
by omission. With all conditions known, choose the unique lowest-rank match, retain
top ties as ambiguous, and valid no-match as unresolved without fallback.

Test-only ranks can prove order-independent resolution without establishing good,
bad or true endings. Numeric priority direction is now explicit; serialization
changes cannot silently reverse previously recorded authored precedence.

## Verification handoff

### TASK-019 compatible-content representation (DEC-027)

The human approved explicit compatibility inside the pinned definition, not
automatic definition upgrades or migration. An incident retains its authored
primary `contentVersion` and may declare `compatibleContentVersions`. All versions
must be unique, resolve to exact validated scenario ID/version authorities and
support declared discovery references. Catalog presence alone grants no eligibility.
A start may explicitly select an allowed `contentVersion`; omission retains the
authored primary, never the latest version. Confirmed baselines retain their exact
allowed source version without target conversion. Each attempt's incident version
and full scenario authority determine subsequent command replay.

An effect's existing `trigger` applies to the primary version. Optional
`additionalTriggers` explicitly name content version, event type and target in the
same logical incident, sharing the effect ID, boundary, condition and entire delta
body. No per-version delta override is allowed. Missing mappings do not automatically
inherit a primary trigger. Validate every target/version and reject duplicate mappings.
Multiple events may match one effect in a command batch, but the first qualifying
event creates the sole run-wide receipt. Compatible retries retain new history and
simulation costs while preserving the first receipt and delta.

Existing single-version definitions retain their shape and authority; adding these
fields to a running definition cannot silently change its pinned authority. No
campaign-definition transition operation, legacy save rewrite, storage migration,
production version declaration or tuning is introduced by this representation.

TASK-019/021/022/023 must exercise typed references/operators, arity, unavailable vs
invalid context, fresh same-attempt support, unique/ambiguous response association,
missing lifecycle rules, known information, and all ending precedence cases.
TASK-020/024/025 must exercise committed acknowledgement before response, actual
gated visibility, abort/lost-ack recovery and legacy/prefix isolation. These are
future tests, not newly passing APIs. Independent review/QA and final contract
acceptance remain necessary before dependent implementation.
