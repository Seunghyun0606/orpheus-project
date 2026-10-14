# Completed prior-Act access — DEC-060

CampaignDefinition schema 1 optionally declares `replayAccess: completed_prior_acts`
for new record/replay v2 authorities. It is absent by default; canonical old
definitions and their current-Act-only behavior remain unchanged.

The pure eligibility engine evaluates every authored Act/Incident condition under
existing strict availability before the shared Act gate. Current-Act access is
unchanged. Opt-in older-Act access additionally requires an earlier Act, exact
completed membership and a replay-verified attempt whose completion event occurred
outside its inherited baseline. Initial seeded membership, baseline-only restoration
or a caller-edited projection cannot establish genuine prior completion. Future Acts,
invalid/unavailable observations and authored denials never become eligible.

Existing start operations create a new attempt without rewinding Act or resetting
history. Monotonic progression effects and once-per-run scores retain their receipt
identities; genuine new behavior samples and Incident costs can still accumulate.
There is no product-name special case, global equality removal or saved-run/operation/
database migration. New definition authority includes the explicit policy, preventing
old-run reattachment or silent reinterpretation.

The exact full runtime package is registered under the approved identity only after
the separate composition/source work. Loading still validates every required
Scenario/model/gate/ending/prose authority before allowing explicit creation or
restoration. Source registration itself is not verification/acceptance. All old/new,
provenance, full-run and native checks remain deferred and mandatory.
