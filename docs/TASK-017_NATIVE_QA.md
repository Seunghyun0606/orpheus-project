# TASK-017 native desktop inspection

Date: 2026-10-09 (Asia/Seoul). Observer: primary developer agent using Computer
Use to inspect and interact with the real Tauri window. Screenshots and live
accessibility snapshots were observed in the tool session; this repository log
does not claim to contain archived screenshot files.

## Candidate and provenance

Base commit: `f00e41c`, plus the TASK-017 recovery-copy regression fix and
responsive service-rail fix in `App.tsx`, `App.test.tsx`, and `base.css`.
The implementation handoff records the committed candidate hash.

Executable: `src-tauri/target/release/orpheus-desktop.exe`, rebuilt with
`npm run build:desktop` after both fixes.

SHA-256:
`A88523CBE359A662197CA1B36FB33197BF469D4436C8037C1F678016B2AD4249`

INC-001 and INC-003 full routes below ran on this final executable. INC-002's
full route ran after the recovery fix but before the CSS-only correction;
its persisted record was then successfully replayed and visually inspected
on the final executable. Final INC-002 narrow-window actions were also inspected.
No simulation, content, or persistence source changed between those builds.

The native helper now connects. The earlier native-pipe failure was a blocked
attempt, not a passing desktop test, and is superseded by these observations.

## Complete routes

### INC-001: Connection Saturation

Final native route:

1. `RESTART_API` (+60s): error rate 3%, connections 310, temporary stabilization.
2. `OPEN_LOGS` (+30s).
3. `ASK_JIN_CONFIRM_IMPACT` (+20s): ETA 1:40; capacity 2/3.
4. `UPDATE_WAR_ROOM` (+15s): operator investigation update appears.
5. `INSPECT_DB` (+60s): at elapsed 03:05, expiration at 03:00 has restored
   connections to 499 and error rate to 28%; recurrence is correctly reported.
6. `INSPECT_SESSIONS` (+90s): 164 idle-in-transaction connections, average age
   47m; Jin's result has returned and pending jobs are zero.
7. `TERMINATE_STALE_SESSIONS` (+120s): UNKNOWN "Good." discovery dialog.
8. Return dismisses the dialog and reveals postmortem at 06:35: final error
   0.2%, customer impact 90, operational risk 14, restart count 1, cause contained.

Postmortem includes the temporary 00:00–03:00 mitigation window and the War Room
update in the action-derived communication record. Earlier direct-resolution
play also produced and persisted CORRUPTED LOG ENTRY.

### INC-002: Bad Deployment

`OPEN_LOGS` → `COMPARE_DEPLOYMENT` → `TRACE_AUTH_REQUEST` →
`ASK_SAM_CHECK_KEYSET` → `OPEN_LOGS` four times → `COMMUNICATE_STATUS` →
`UPDATE_VERIFIER_KEYSET`.

Observed build 1847 vs 1846 and issuer K72/verifier K71 evidence. Sam starts
with ETA 1:40/capacity 2/3, returns capacity to 3/3, and completes the delegated
work without falsely reporting expired mitigation. UNKNOWN says
"deployment 1847 isn't what they told you." Return dismisses the discovery.

Postmortem: elapsed 07:15, authorization error 0.5%, customer impact 151,
operational risk 4, verifier update count 1, status update count 1, cause contained.
After relaunching the final executable, Review INC-002 reconstructs
the same ten-action record and outcomes from campaign discoveries.

### INC-003: Queue Backlog

`OPEN_LOGS` → `TRACE_RETRY` → `COMPARE_BATCH` → `ASK_JIN_CONFIRM_IMPACT` →
`COMMUNICATE_STATUS` → `ADD_DEAD_LETTER_RULE`.

Observed batch 781/message 44 and legacy_v3 vs receipt_v4 evidence. Delegation
at 02:15 displays ETA 1:40/capacity 2/3; the later result returns capacity.
UNKNOWN says "check the request that arrived before batch 781." The dialog
and Continue control fit at 150% text in the minimum-size window; Return works.

Postmortem: elapsed 05:15, queue depth 1,800, oldest-message age 3, customer impact
106, response cost 100, operational risk 4, dead-letter count 1, status update
count 1, cause contained. After relaunch, Review INC-003 reconstructs the same
six-action record and outcomes from campaign discoveries.

## Shared desktop checks

| Check                   | Directly observed result                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desk / navigation       | All three incidents start from the shared desk; completed records remain available after relaunch. Final desk still lists the original INC-001 save.                                                                                                                         |
| Cross-incident Evidence | INC-002 shows prior CORRUPTED LOG ENTRY and current findings; INC-003 shows prior discoveries plus its own findings and UNKNOWN history. No later identity is disclosed.                                                                                                     |
| Keyboard                | Return closes UNKNOWN dialogs; Left moves War Room to Evidence; the save dialog cycles focus between keep/confirm with Tab, and Escape cancels and returns visible focus to Save.                                                                                            |
| Save protection         | INC-002 Save opens explicit INC-001 → INC-002 replacement confirmation. Cancellation preserves the original slot; no overwrite was executed.                                                                                                                                 |
| Legacy load             | Final executable resumes the original content 1.0.0 INC-001 save, displays the migration notice, and reconstructs its 05:00 postmortem (0.2% error, impact 82, risk 6). Loading does not rewrite the save.                                                                   |
| Display controls        | CRT off, reduced animation on, and 150% text were exercised and survived relaunch. Original preferences were restored afterward: CRT on, reduced animation off, standard 100% text.                                                                                          |
| Narrow layout           | Outer window approximately 963 x 672 (960 x 640 content minimum) at 150%: Evidence, UNKNOWN dialog, actions, and postmortem remain readable through scrolling. The service rail no longer overlays them. At 100%, minimum-width INC-002's full-row action grid is uncovered. |
| Archive remount         | Final binary reopens INC-002 and INC-003 postmortems as reconstructed completed records with matching action lists and measured outcomes.                                                                                                                                    |

## Resolved findings and limits

The misleading recovery message was independently found in code review and
confirmed in native play. The overlapping sticky rail was found in native QA.
Both fixes were independently reviewed, rebuilt, and retested before this log.
The computer-use skill's observe/action/refresh workflow governed these checks;
no alternate Windows automation or security changes were used.

Native minimum width is 960, not 320: no native 320px claim is made. This is not
a complete screen-reader or audio audit. Native confirmed overwrite, corrupt-save
handling, and concurrent writers were not exercised against user data; their
coverage is automated. The original single incident save and its compatibility
were preserved, while normal gameplay wrote separate campaign discoveries.

Independent reviewers audit this log and executable/source provenance. They did
not perform these native inputs themselves. M3 completion remains a human gate.
