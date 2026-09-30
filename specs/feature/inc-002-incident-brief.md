# INC-002 — Bad Deployment Incident Brief

## Scope and player question

This is an Act 1 production failure, not evidence of an attacker or an experiment. A Payment Identity deployment changes the token key identifier emitted by the issuer before the downstream verifier has the matching key set. The player should distinguish immediate relief from containment of the incompatible rollout by inspecting logs, metrics, a request trace, and the deployment comparison. This brief precedes scenario authoring for TASK-012.

## Causal chain

`deployment 1847 activates token key K72` → `verifier still accepts K71` → `new payment sessions fail authorization` → `checkout errors and retries rise` → `customer impact accumulates while time passes`.

The rollout ordering, rather than the existence of a new key alone, is the failure mechanism. The pager initially exposes elevated authorization errors, not the key mismatch. Logs and tracing reveal the emitted and accepted key identifiers; deployment comparison identifies the rollout and previous stable version.

## Observable state and investigation

- Pager: Payment authorization error rate exceeds its threshold; the Identity API and payment gateway are implicated.
- Metrics: error rate, retry volume, and service load are visible; inspecting metrics reveals the retry trend.
- Logs: key-identifier rejection signature is revealed, but not interpreted as proof of malicious action.
- Trace: the issuer's K72 and verifier's K71 are observed on the same failing request.
- Deployment history: build 1847 and its prior stable build are compared, establishing chronology without replacing the trace.

## Actions and trade-offs

- Route new authorization traffic to the stable region: fast temporary relief, extra cost and operational risk. If the incompatibility remains, traffic returns after the short routing window and errors recur. Repeating this action renews the window and replaces its prior return-to-traffic timer, at the same additional cost and risk.
- Roll back build 1847 after investigating the trace and deployment: faster causal containment, but session churn and rollback risk increase impact.
- Update the verifier key set after investigating the trace and deployment: slower causal containment, but avoids rollback churn while consuming more investigation time.
- Communicate status: consumes time but appears in the action-derived postmortem; it is neither a win condition nor a penalty label.

All action costs represent additional customer exposure during elapsed time. A timer is cancelled by either causal-containment action, so a resolved mechanism cannot produce a false recurrence.

## Evidence and narrative boundary

The deployment and request trace are operational evidence. A small transient `UNKNOWN` artifact may be exposed only through ordinary investigation; it must not identify NULL, ORPHEUS, a controlled experiment, or any later-act fact. The player can complete the incident without this optional artifact.

## Replay and postmortem expectations

At least two deterministic paths should be recorded: temporary routing followed by rollback, and investigation followed by the verifier key-set update. Their elapsed time, customer impact, risk, event history, and action-derived postmortem must differ. A separate replay should show routing relief followed by recurrence if containment is delayed. No report uses a right/wrong label.
