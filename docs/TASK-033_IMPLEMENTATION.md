# TASK-033 — Windows accessibility and synthesized audio candidate

## Completed implementation scope (not acceptance)

DEC-061 records approval of the proposal at `6929c90`. Implementation readiness
now depends on accepted TASK-026, and `projectctl claim` activated TASK-033.
TASK-027/032 and M4 remain incomplete; TASK-034/035 readiness is unchanged.

- A separate strict `orpheus.audio.v1` preference envelope defaults to muted and
  volume 0.35. Unsupported bytes are retained, not migrated. Failed preference
  writes report memory-only controls, never a campaign commit or alternate ledger.
- A local explicit activation button alone creates/resumes Web Audio. Restored
  unmuted preferences do not activate output. Mute, hidden windows, archive entry
  and unmount stop voices; return requires explicit resume. Zero volume stops
  voices. Finite cues and bounded voices avoid accumulating notification timers.
- The campaign adapter exposes a transient post-commit observer. It emits after
  identity verification and record publication, not during candidate preparation,
  reload or restoration. Lost ACK keeps exact retry identity; observer failures
  cannot change durable success. No saved-run, operation or database schema changes.
- New live starts produce pager feedback; new completed actions produce relay
  feedback, investigation/War Room events a notification, and newly CRITICAL
  revealed string status an alarm. No guessed numeric severity threshold is used.
  Hidden statuses and checkpoint history do not generate alarms. No historical
  alerts on mount/reload/archive; hum and local keyboard feedback are presentation
  only. All operational notifications have a visible text counterpart.
- Campaign section shortcuts, focusable scroll tables with captions, non-color
  status text, preserved multiline records, scalable headings/controls and scoped
  reduced-animation/CRT-off styling cover the campaign entry, desk, investigation,
  evidence, archive, guidance, ending and settings. Audio controls are only mounted
  for an explicitly composed campaign, not default MVP startup or framework mode.

## Source and license inventory

| Cue            | Source                                       | Visual alternative                                           |
| -------------- | -------------------------------------------- | ------------------------------------------------------------ |
| pager          | `src/audio/cues.ts`, three finite sine tones | New incident attempt committed                               |
| keyboard       | same, short triangle tone                    | Focused native control/input; no essential information       |
| server_hum     | same, two low sine oscillators               | Live attempt/archive and audio output status                 |
| notification   | same, two finite sine tones                  | New investigation or War Room information committed          |
| relay          | same, short triangle tone                    | Action completed and committed; existing action/event record |
| critical_alarm | same, two finite sine tones                  | Newly CRITICAL revealed status and existing signal text      |

These are repository-authored synthesis parameters, not third-party recordings.
There are no audio downloads, microphone permissions, external asset licenses or
new repository-wide license grants. Distribution/license review remains TASK-034.
AudioContext time schedules oscillators only; it never advances engine time or
alters actions, RNG, replay, guidance acknowledgements or campaign authority.

## Changed files

`src/audio/{preferences,cues,synth,audio.test}.ts`, `CampaignAudio.tsx`, campaign
desk/tools/ending/entry components, `campaign-session.ts` and its test,
`campaign-audio-accessibility.test.tsx`, `base.css`, DEC-061 and task metadata.

## Tests and evidence

**Not run: QA explicitly deferred, not waived.** Authored coverage addresses strict
preferences, blocked storage, lazy activation, volume/mute/visibility/disposal,
pending-resume cancellation, unsupported output, hidden statuses, checkpoint
suppression, commit/abort/conflict/lost-ACK boundaries, throwing observers,
presentation-only controls and text scaling. Tests themselves are unverified.
No typecheck, lint, validator, build, test, browser or native execution is claimed.

## Known risks and remaining work

The complete 26-Incident package remains unverified; registration is not proof of
playability or ending reachability. Native Windows x64 WebView2 audio autoplay,
device failure, visibility, keyboard traversal, Narrator and 960x640 at 150% text
must be tested on the actual candidate. DOM checks cannot certify native layout,
contrast or screen-reader announcements. Synthesized sound levels/overlap require
listening checks. Archive focus and long documents/tables require real keyboard
checks. Existing M4 and all M5 independent review/QA/evaluation remain mandatory.
No TASK-033 acceptance or completion, push, installer, publication or release.

## Next recommended step

TASK-034 still requires completed TASK-032/033 and approved measurable budgets and
local packaging scope. Obtain a separate readiness/delivery decision before early
implementation; do not equate this candidate with completed prerequisites.
