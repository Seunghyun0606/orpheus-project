import { cueText, type AudioCue } from '../../audio/cues.ts';
import type { AudioStatus } from '../../audio/synth.ts';
import { defineMessages } from '../../i18n/locale.ts';

// The audio layer reports storage problems as fixed English sentences.
const koStorageErrors: ReadonlyMap<string, string> = new Map([
  [
    'Stored audio preferences are unsupported; preserved without rewriting.',
    '저장된 오디오 설정을 지원하지 않습니다. 덮어쓰지 않고 그대로 둡니다.',
  ],
  [
    'Audio preferences unavailable; using memory only.',
    '오디오 설정을 불러올 수 없어 이번 실행 동안만 기억합니다.',
  ],
  ['Invalid audio preferences; not saved.', '오디오 설정이 올바르지 않아 저장하지 않았습니다.'],
  [
    'Audio preferences not saved; controls work in memory only.',
    '오디오 설정을 저장하지 못했습니다. 이번 실행 동안만 적용됩니다.',
  ],
]);

export const audioMessages = defineMessages({
  en: {
    status: {
      inactive: 'off',
      enabled: 'on',
      paused: 'paused',
      unavailable: 'unavailable',
    } satisfies Record<AudioStatus, string>,
    cues: cueText,
    noNotice: 'No new sound notifications.',
    intro: 'Optional sound only. Everything you need to play is always shown on screen.',
    soundStatus: (status: string) => `Sound: ${status}.`,
    muted: 'Muted.',
    allowed: 'Sound is allowed; press Enable after opening or returning to this screen.',
    enable: 'Enable / resume audio',
    mute: 'Mute audio',
    volume: (percent: number) => `Master volume: ${percent}%`,
    unavailable: 'Audio unavailable. Silent visual gameplay is unchanged.',
    storageError: (message: string) => message,
    legend:
      'Pager: new incident. Relay: action finished. Chime: new information. Alarm: a service turned critical. Hum: live ambience. Keys: typing feedback.',
    summary: (state: string) => `Sound settings (${state})`,
    summaryMuted: 'muted',
    title: 'Sound',
  },
  ko: {
    status: {
      inactive: '꺼짐',
      enabled: '켜짐',
      paused: '일시 정지',
      unavailable: '사용할 수 없음',
    } satisfies Record<AudioStatus, string>,
    cues: {
      pager: '새 인시던트 시도가 기록되었습니다.',
      keyboard: '로컬 키보드 피드백.',
      server_hum: '실시간 운영 배경음.',
      notification: '새 조사 정보 또는 워룸 정보가 기록되었습니다.',
      relay: '조치가 완료되어 기록되었습니다.',
      critical_alarm: '확인된 서비스 상태가 CRITICAL이 되었습니다.',
    } satisfies Record<AudioCue, string>,
    noNotice: '새 소리 알림이 없습니다.',
    intro: '소리는 선택 사항입니다. 플레이에 필요한 모든 정보는 항상 화면에 표시됩니다.',
    soundStatus: (status: string) => `소리: ${status}.`,
    muted: '음소거됨.',
    allowed: '소리가 허용되어 있습니다. 이 화면을 열거나 돌아온 뒤 오디오 켜기를 누르세요.',
    enable: '오디오 켜기 / 다시 재생',
    mute: '오디오 음소거',
    volume: (percent: number) => `전체 음량: ${percent}%`,
    unavailable: '오디오를 사용할 수 없습니다. 소리 없이도 화면 플레이는 그대로입니다.',
    storageError: (message: string) => koStorageErrors.get(message) ?? message,
    legend:
      '호출음: 새 인시던트. 릴레이: 조치 완료. 차임: 새 정보. 경보: 서비스가 위험 상태로 전환. 험: 실시간 배경음. 키: 타이핑 피드백.',
    summary: (state: string) => `소리 설정 (${state})`,
    summaryMuted: '음소거',
    title: '소리',
  },
});
