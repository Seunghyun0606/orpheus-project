import type { CampaignCommittedUpdate } from '../store/campaign-session.ts';
import type { EngineEvent, RuntimeSignal } from '../engine/types.ts';
export type AudioCue =
  'pager' | 'keyboard' | 'server_hum' | 'notification' | 'relay' | 'critical_alarm';
export const cueText: Record<AudioCue, string> = {
  pager: 'New incident attempt committed.',
  keyboard: 'Local keyboard feedback.',
  server_hum: 'Live operations ambience.',
  notification: 'New investigation or War Room information committed.',
  relay: 'Action completed and committed.',
  critical_alarm: 'A revealed service status became CRITICAL.',
};
export interface Tone {
  frequency: number;
  offset: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}
// Repository-authored DSP parameters. No samples, network, random noise or domain clock.
export const tones: Record<AudioCue, readonly Tone[]> = {
  pager: [0, 0.18, 0.36].map((offset): Tone => ({
    frequency: 880,
    offset,
    duration: 0.1,
    gain: 0.12,
    type: 'sine',
  })),
  keyboard: [{ frequency: 420, offset: 0, duration: 0.025, gain: 0.035, type: 'triangle' }],
  server_hum: [
    { frequency: 55, offset: 0, duration: 0, gain: 0.025, type: 'sine' },
    { frequency: 110, offset: 0, duration: 0, gain: 0.008, type: 'sine' },
  ],
  notification: [
    { frequency: 660, offset: 0, duration: 0.12, gain: 0.08, type: 'sine' },
    { frequency: 990, offset: 0.13, duration: 0.12, gain: 0.06, type: 'sine' },
  ],
  relay: [{ frequency: 180, offset: 0, duration: 0.045, gain: 0.045, type: 'triangle' }],
  critical_alarm: [
    { frequency: 440, offset: 0, duration: 0.18, gain: 0.1, type: 'sine' },
    { frequency: 330, offset: 0.22, duration: 0.18, gain: 0.1, type: 'sine' },
  ],
};
// Shared mapping from accepted engine events to presentation cues. Used by the
// campaign ledger callback and the MVP incident flow alike; never a domain input.
export function eventCues(
  events: readonly EngineEvent[],
  signals: Readonly<Record<string, RuntimeSignal>>,
): AudioCue[] {
  const cues: AudioCue[] = [];
  if (events.some((e) => e.type === 'action_completed')) cues.push('relay');
  if (
    events.some((e) =>
      ['evidence_revealed', 'narrative_triggered', 'war_room_message'].includes(e.type),
    )
  )
    cues.push('notification');
  if (
    events.some(
      (e) =>
        e.type === 'signal_changed' &&
        e.targetId &&
        signals[e.targetId]?.revealed &&
        e.value === 'CRITICAL' &&
        e.previousValue !== 'CRITICAL',
    )
  )
    cues.push('critical_alarm');
  return cues;
}
export function committedCues(update: CampaignCommittedUpdate): AudioCue[] {
  if (update.operation.kind === 'start') return ['pager'];
  if (update.operation.kind !== 'command') return [];
  return eventCues(update.events, update.signals);
}
