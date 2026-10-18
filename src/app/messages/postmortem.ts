import type { PostmortemMetric } from '../../engine/index.ts';
import { defineMessages } from '../../i18n/locale.ts';

export const postmortemMessages = defineMessages({
  en: {
    eyebrow: 'VANTAGE SYSTEMS // INCIDENT ARCHIVE',
    kicker: (id: string) => `${id} / RESPONSE RECORD`,
    title: 'Incident postmortem',
    subtitle: (title: string) =>
      `${title} · Reconstructed from the incident state and recorded actions.`,
    incidentDesk: 'Incident desk',
    returnToRecord: 'Return to incident record',
    restartIncident: 'Restart incident',
    outcomesEyebrow: '01 / Measured outcomes',
    outcomesTitle: 'What the response changed',
    outcomesIntro:
      'These are observations, not a grade. Time, impact, risk, and action counts come from the completed incident.',
    metricSource: {
      elapsed_time: 'elapsed time',
      signal: 'signal',
      resource: 'resource',
      action_count: 'action count',
    } satisfies Record<PostmortemMetric['source'], string>,
    causeEyebrow: '02 / Root cause',
    causeTitle: 'Failure mechanism',
    contained: 'CONTAINED',
    notContained: 'NOT CONTAINED',
    communicationEyebrow: '03 / Communication',
    communicationTitle: 'Recorded updates',
    noCommunication: 'No status update was recorded during this response.',
    communicationAction: (ordinal: number, duration: string) => `Action ${ordinal} · ${duration}`,
    interventionsEyebrow: '04 / Causal review',
    interventionsTitle: 'Mitigation and additional interventions',
    interventionsIntro:
      'Non-resolving actions may have changed telemetry or bought time, but did not themselves contain a failure mechanism.',
    noInterventions: 'No non-resolving intervention was recorded.',
    interventionCount: (count: number, duration: string) => `${count} × ${duration} EACH`,
    interventionNote:
      'Did not contain the root cause. This describes its observed effect, not whether the choice was right or wrong.',
    temporaryWindows: 'Temporary windows',
    temporaryWindow: (action: string, effect: string, started: string, expired?: string) =>
      `${action}: ${effect} started at ${started} and ${
        expired === undefined
          ? 'remained active at the end of this record'
          : `expired at ${expired}`
      }.`,
    delayedConditions: 'Delayed conditions observed',
    actionsEyebrow: '05 / Action record',
    actionsTitle: 'What happened, in order',
    saveControls: 'Local session save controls',
    saveSession: 'Save session',
    loadSession: 'Load saved session',
  },
  ko: {
    eyebrow: 'VANTAGE SYSTEMS // 인시던트 아카이브',
    kicker: (id: string) => `${id} / 대응 기록`,
    title: '인시던트 사후 분석',
    subtitle: (title: string) => `${title} · 인시던트 상태와 기록된 조치로 재구성했습니다.`,
    incidentDesk: '장애 대응 데스크',
    returnToRecord: '인시던트 기록으로 돌아가기',
    restartIncident: '인시던트 다시 시작',
    outcomesEyebrow: '01 / 측정 결과',
    outcomesTitle: '대응이 바꾼 것',
    outcomesIntro:
      '채점이 아니라 관찰 결과입니다. 시간, 피해, 리스크, 조치 수는 완료된 인시던트에서 가져왔습니다.',
    metricSource: {
      elapsed_time: '경과 시간',
      signal: '신호',
      resource: '리소스',
      action_count: '조치 수',
    } satisfies Record<PostmortemMetric['source'], string>,
    causeEyebrow: '02 / 근본 원인',
    causeTitle: '장애 메커니즘',
    contained: '차단됨',
    notContained: '차단 안 됨',
    communicationEyebrow: '03 / 소통',
    communicationTitle: '기록된 상황 공유',
    noCommunication: '이번 대응에서는 상황 공유가 기록되지 않았습니다.',
    communicationAction: (ordinal: number, duration: string) => `조치 ${ordinal} · ${duration}`,
    interventionsEyebrow: '04 / 인과 검토',
    interventionsTitle: '완화 조치와 추가 개입',
    interventionsIntro:
      '해결로 이어지지 않은 조치는 텔레메트리를 바꾸거나 시간을 벌었을 수 있지만, 그 자체로 장애 메커니즘을 차단하지는 않았습니다.',
    noInterventions: '해결로 이어지지 않은 개입은 기록되지 않았습니다.',
    interventionCount: (count: number, duration: string) => `${count}회 × 회당 ${duration}`,
    interventionNote:
      '근본 원인을 차단하지 못했습니다. 관찰된 효과를 설명할 뿐, 선택이 옳았는지 틀렸는지를 말하지 않습니다.',
    temporaryWindows: '임시 완화 구간',
    temporaryWindow: (action: string, effect: string, started: string, expired?: string) =>
      expired === undefined
        ? `${action}: ${effect} — ${started}에 시작, 기록이 끝날 때까지 유지됨.`
        : `${action}: ${effect} — ${started}에 시작, ${expired}에 만료됨.`,
    delayedConditions: '관찰된 지연 조건',
    actionsEyebrow: '05 / 조치 기록',
    actionsTitle: '일어난 일, 순서대로',
    saveControls: '로컬 세션 저장 제어',
    saveSession: '세션 저장',
    loadSession: '저장된 세션 불러오기',
  },
});
