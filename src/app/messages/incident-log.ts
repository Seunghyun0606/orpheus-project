import { defineMessages } from '../../i18n/locale.ts';

export const incidentLogMessages = defineMessages({
  en: {
    completed: (action: string) => `Completed: ${action}`,
    unlocked: (action: string) => `New option available: ${action}`,
    observation: (signal: string) => `New observation: ${signal}`,
    observationValue: (signal: string, value: string) => `New observation: ${signal} = ${value}`,
    temporaryStarted: 'Temporary relief applied; the underlying cause is still open',
    temporaryExpired: 'Temporary relief expired',
    conditionTriggered: (condition: string) => `Condition triggered: ${condition}`,
    evidencePreserved: (evidence: string) => `Evidence preserved: ${evidence}`,
    anomalyFlagged: (entry: string) => `Log anomaly flagged: ${entry}`,
    warRoomMessage: (message: string) => `War Room message: ${message}`,
    causeContained: (mechanism: string) => `Underlying cause contained: ${mechanism}`,
    rootCauseResolved: 'Root cause resolved',
    recoveryConfirmed: 'Service recovery confirmed',
  },
  ko: {
    completed: (action: string) => `완료: ${action}`,
    unlocked: (action: string) => `새 선택지: ${action}`,
    observation: (signal: string) => `새 관찰: ${signal}`,
    observationValue: (signal: string, value: string) => `새 관찰: ${signal} = ${value}`,
    temporaryStarted: '임시 완화 적용됨. 근본 원인은 아직 남아 있음',
    temporaryExpired: '임시 완화 만료됨',
    conditionTriggered: (condition: string) => `조건 발생: ${condition}`,
    evidencePreserved: (evidence: string) => `증거 보존됨: ${evidence}`,
    anomalyFlagged: (entry: string) => `로그 이상 감지: ${entry}`,
    warRoomMessage: (message: string) => `워룸 메시지: ${message}`,
    causeContained: (mechanism: string) => `근본 원인 차단됨: ${mechanism}`,
    rootCauseResolved: '근본 원인 해결됨',
    recoveryConfirmed: '서비스 복구 확인됨',
  },
});
