import { defineMessages } from '../../i18n/locale.ts';

export const campaignEntryMessages = defineMessages({
  en: {
    errors: {
      empty: 'No complete campaign is available in this build.',
      runGone: 'Saved run is no longer available.',
      identityExists: 'New run identity already exists; preserved without overwrite.',
      unknownVersion:
        'This save was made with a campaign version this build does not include. It is preserved unchanged.',
      storage: 'Campaign files or local storage are unavailable right now.',
      unconfirmed: 'Campaign operation not confirmed; saved data is preserved.',
    },
    codeErrors: {
      listFailed: (code: string) =>
        `Saved campaigns could not be listed. Technical detail: ${code}`,
      openFailed: (code: string) => `This save could not be opened. Technical detail: ${code}`,
      // A session store error is shown as its code.
      store: (code: string) => code,
    },
    detailsUnavailable: 'Details unavailable; the save is kept as-is.',
    runDetail: (act: string, closed: number) =>
      `${act} · ${closed} incident${closed === 1 ? '' : 's'} closed`,
    entryLabel: 'Full campaign entry',
    eyebrow: 'VANTAGE SYSTEMS // RELIABILITY ROTATION',
    title: 'Full campaign',
    intro:
      'The long rotation: incidents across nine acts, one continuous record. Each incident plays like the training ones, but your choices carry forward, and something in the stack starts to notice how you make them.',
    screenSettings: 'Screen settings',
    backToDesk: 'Back to incident desk',
    filesTitle: 'Campaign files',
    nothingCreated:
      'Nothing is created until you choose. Your training-rotation saves are kept separately.',
    openFiles: 'Open campaign files',
    checking: 'Checking campaign files…',
    notInBuild: 'The full campaign is not available in this build.',
    technicalDetail: (detail: string) => `Technical detail: ${detail}`,
    newCampaign: 'New campaign',
    incidentCount: (count: number) => `${count} incidents. `,
    staticViews:
      'Investigation views are static in this version (no live narrative or War Room feed). ',
    contentVersion: (version: string) => `Content version ${version}`,
    savedTitle: 'Saved campaigns',
    continue: 'Continue',
    savedVersion: (version: string) => ` · version ${version}`,
    checkAgain: 'Check campaign files again',
  },
  ko: {
    errors: {
      empty: '이 빌드에는 완성된 캠페인이 없습니다.',
      runGone: '저장된 진행 기록을 더 이상 찾을 수 없습니다.',
      identityExists: '새 진행 기록의 식별자가 이미 존재합니다. 덮어쓰지 않고 보존했습니다.',
      unknownVersion:
        '이 저장 데이터는 이 빌드에 없는 캠페인 버전으로 만들어졌습니다. 바꾸지 않고 그대로 보존합니다.',
      storage: '지금은 캠페인 파일이나 로컬 저장소를 사용할 수 없습니다.',
      unconfirmed: '캠페인 작업이 확인되지 않았습니다. 저장된 데이터는 보존됩니다.',
    },
    codeErrors: {
      listFailed: (code: string) => `저장된 캠페인 목록을 불러오지 못했습니다. 기술 정보: ${code}`,
      openFailed: (code: string) => `이 저장 데이터를 열 수 없습니다. 기술 정보: ${code}`,
      store: (code: string) => `캠페인 기록을 열 수 없습니다. 기술 정보: ${code}`,
    },
    detailsUnavailable: '세부 정보를 확인할 수 없습니다. 저장 데이터는 그대로 보존됩니다.',
    runDetail: (act: string, closed: number) => `${act} · 인시던트 ${closed}건 종료`,
    entryLabel: '전체 캠페인 입구',
    eyebrow: 'VANTAGE SYSTEMS // 신뢰성 로테이션',
    title: '전체 캠페인',
    intro:
      '긴 로테이션: 아홉 막에 걸친 인시던트, 이어지는 하나의 기록. 각 인시던트는 훈련 때와 같은 방식으로 진행되지만, 당신의 선택은 다음으로 이어지고, 스택 어딘가의 무언가가 당신이 어떻게 선택하는지 알아차리기 시작합니다.',
    screenSettings: '화면 설정',
    backToDesk: '장애 대응 데스크로 돌아가기',
    filesTitle: '캠페인 파일',
    nothingCreated:
      '직접 고르기 전에는 아무것도 만들어지지 않습니다. 훈련 로테이션 저장 데이터는 따로 보관됩니다.',
    openFiles: '캠페인 파일 열기',
    checking: '캠페인 파일을 확인하는 중…',
    notInBuild: '이 빌드에서는 전체 캠페인을 사용할 수 없습니다.',
    technicalDetail: (detail: string) => `기술 정보: ${detail}`,
    newCampaign: '새 캠페인',
    incidentCount: (count: number) => `인시던트 ${count}건. `,
    staticViews: '이 버전의 조사 화면은 정적입니다 (실시간 메시지나 워룸 피드 없음). ',
    contentVersion: (version: string) => `콘텐츠 버전 ${version}`,
    savedTitle: '저장된 캠페인',
    continue: '계속하기',
    savedVersion: (version: string) => ` · 버전 ${version}`,
    checkAgain: '캠페인 파일 다시 확인',
  },
});

export type CampaignEntryMessages = (typeof campaignEntryMessages)['en'];
