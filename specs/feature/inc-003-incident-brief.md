# INC-003 — Queue Backlog Incident Brief

## Scope and player question

This Act 1 incident concerns delayed payment receipts, not failed payments. A malformed receipt in partner batch 781 repeatedly fails the receipt worker's parser. The queue retries it at the head of a partition, so later valid receipts wait behind it. The player must distinguish visible queue pressure from the message that sustains it. This brief precedes TASK-013 scenario authoring.

## Causal chain

`partner batch 781 includes a legacy-format receipt` → `receipt worker rejects and retries the same message` → `one partition makes little forward progress` → `queue depth and oldest-message age rise` → `customers receive late receipts`. Retried work amplifies pressure despite moderate worker CPU. The incident must not imply that a larger worker pool fixes the malformed message.

## Investigation and evidence

- Pager shows Receipt Worker and an oldest-message-age threshold; queue depth and receipt delay are visible.
- Metrics reveal the low acknowledgement rate, high retry rate, and moderate worker CPU.
- Logs show repeated parser rejection of one message; a retry trace reveals its message id and the legacy-versus-expected schema mismatch.
- Batch comparison identifies the source batch. The trace and comparison are separately investigable, and both are required before causal intervention.
- Recovered trace and batch records remain evidence after the queue is restored.

## Actions and trade-offs

- Add temporary consumers: queue depth and age improve quickly at a monetary and operational cost, but the stuck partition returns to the foreground after 180 seconds unless the cause is contained. Repeating the action renews that window and replaces its old rebound timer at additional cost.
- Quarantine the malformed message: quicker causal containment with a higher risk of a missing receipt requiring later reconciliation.
- Add a narrowly scoped dead-letter rule: slower and more expensive causal containment that retains the malformed item for review, with lower operational risk.
- Communicate the receipt delay: consumes time and is recorded in the postmortem; no action is labelled intrinsically right or wrong.

Each action's customer-impact cost represents exposure during that action. The rebound event adds further impact if temporary relief expires before containment. Causal actions cancel that event and update queue signals to match the recovery path.
Once the cause is contained, further temporary scaling or a second causal intervention is unavailable.

## Narrative boundary and replay expectations

This is an ordinary production incident. Authored content reveals operational queue evidence only; cross-incident `UNKNOWN` material is deferred to the later M3 narrative task. No later-act identity or experiment is disclosed. Deterministic replays should cover temporary relief and rebound, quarantine after temporary relief, and a slower dead-letter path. The paths must differ in elapsed time, customer impact, risk, cost, and action-derived postmortem inputs.
