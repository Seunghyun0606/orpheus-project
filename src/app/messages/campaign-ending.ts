import { defineMessages } from '../../i18n/locale.ts';

export const campaignEndingMessages = defineMessages({
  en: {
    authoredFuture: 'Authored future institutional report — not measured player behavior',
    authoredPolicy: 'Authored policy record',
    // Authored speaker IDs shown as written in English.
    speakers: {} as Readonly<Record<string, string>>,
    profileEyebrow: 'ORPHEUS // OBSERVATION FILE',
    profileTitle: 'ORPHEUS subject profile',
    profileNote:
      'Measured from what you actually did across the campaign. Read-only; there is no right profile.',
    profileEmpty: 'Not enough recorded behavior to build a profile.',
    unavailable: (detail: string) => `Ending presentation unavailable. Technical detail: ${detail}`,
    finaleLabel: 'Campaign finale',
    ambiguous:
      'Your record points to more than one ending equally. No single ending is chosen for you.',
    none: 'Your record does not match any authored ending. No ending is chosen for you.',
    resolvedLabel: 'Resolved campaign ending',
    eyebrow: 'FINALE // CAMPAIGN ENDING',
    recordTitle: 'Actual final incident record',
    closedAt: (incident: string, time: string) => `${incident} · closed at ${time}`,
    committed: 'Committed',
    notCommitted: 'Not committed',
    recovered: 'Recovery criteria reached',
    notRecovered: 'Recovery criteria not reached',
    outcome: (completion: string, recovery: string) =>
      `Decision completion: ${completion}. Service recovery: ${recovery}.`,
    signalsRegion: 'Recorded service signals, scroll to read',
    signalsCaption: 'Recorded service signals at this final attempt',
    service: 'Service',
    signal: 'Signal',
    value: 'Recorded value',
  },
  ko: {
    authoredFuture: '작성된 미래 기관 보고서 — 측정된 플레이어 행동이 아님',
    authoredPolicy: '작성된 정책 기록',
    speakers: { PLAYER: '플레이어' },
    profileEyebrow: 'ORPHEUS // 관찰 파일',
    profileTitle: 'ORPHEUS 피험자 프로필',
    profileNote:
      '캠페인 내내 당신이 실제로 한 행동으로 측정했습니다. 읽기 전용이며, 정답인 프로필은 없습니다.',
    profileEmpty: '프로필을 만들 만큼 기록된 행동이 없습니다.',
    unavailable: (detail: string) => `엔딩을 표시할 수 없습니다. 기술 정보: ${detail}`,
    finaleLabel: '캠페인 피날레',
    ambiguous: '기록이 둘 이상의 엔딩을 똑같이 가리킵니다. 어느 한 엔딩도 정해지지 않습니다.',
    none: '기록이 작성된 어떤 엔딩과도 맞지 않습니다. 엔딩이 정해지지 않습니다.',
    resolvedLabel: '확정된 캠페인 엔딩',
    eyebrow: '피날레 // 캠페인 엔딩',
    recordTitle: '마지막 인시던트의 실제 기록',
    closedAt: (incident: string, time: string) => `${incident} · ${time}에 종료`,
    committed: '확정됨',
    notCommitted: '확정되지 않음',
    recovered: '복구 기준 도달',
    notRecovered: '복구 기준 미달',
    outcome: (completion: string, recovery: string) =>
      `결정 완료: ${completion}. 서비스 복구: ${recovery}.`,
    signalsRegion: '기록된 서비스 신호, 스크롤해서 읽기',
    signalsCaption: '이 마지막 시도에서 기록된 서비스 신호',
    service: '서비스',
    signal: '신호',
    value: '기록된 값',
  },
});

export const campaignNoticeMessages = defineMessages({
  en: {
    label: 'New recorded narrative',
    filed: "Filed in this incident's message history. Dismissing it changes nothing.",
    goToHistory: 'Go to the message history',
    dismiss: 'Dismiss notification',
  },
  ko: {
    label: '새로 기록된 메시지',
    filed: '이 인시던트의 메시지 이력에 보관되었습니다. 닫아도 아무것도 바뀌지 않습니다.',
    goToHistory: '메시지 이력으로 이동',
    dismiss: '알림 닫기',
  },
});
