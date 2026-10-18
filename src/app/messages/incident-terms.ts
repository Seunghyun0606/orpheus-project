import type { CommandFailureCode } from '../../engine/index.ts';
import { defineMessages, type Locale } from '../../i18n/locale.ts';
import type { SaveErrorCode } from '../../persistence/index.ts';
import type { Scenario } from '../../scenario/index.ts';
import type { IncidentPersistenceNoticeDetail } from '../../store/incident-session.ts';
import { humanize } from '../format.ts';
import type { LogLevel } from '../incident-log.ts';

// Vocabulary shared by the incident screen, its log and the postmortem. Keys are
// the stable English/ID values (CSS classes derive from those, never the label).

export type ActionCategory = Scenario['actions'][number]['category'];

export const actionCategoryLabels = defineMessages<Record<ActionCategory, string>>({
  en: {
    OBSERVE: 'OBSERVE',
    INVESTIGATE: 'INVESTIGATE',
    DIAGNOSE: 'DIAGNOSE',
    MITIGATE: 'MITIGATE',
    MODIFY: 'MODIFY',
    DELEGATE: 'DELEGATE',
    COMMUNICATE: 'COMMUNICATE',
  },
  ko: {
    OBSERVE: '관찰',
    INVESTIGATE: '조사',
    DIAGNOSE: '진단',
    MITIGATE: '완화',
    MODIFY: '변경',
    DELEGATE: '위임',
    COMMUNICATE: '소통',
  },
});

export const logLevelLabels = defineMessages<Record<LogLevel, string>>({
  en: {
    CRITICAL: 'CRITICAL',
    OBSERVE: 'OBSERVE',
    ACTION: 'ACTION',
    METRIC: 'METRIC',
    WARN: 'WARN',
    ANOMALY: 'ANOMALY',
    TEAM: 'TEAM',
    RESOLVED: 'RESOLVED',
    INFO: 'INFO',
  },
  ko: {
    CRITICAL: '치명',
    OBSERVE: '관찰',
    ACTION: '조치',
    METRIC: '지표',
    WARN: '경고',
    ANOMALY: '이상',
    TEAM: '팀',
    RESOLVED: '해결',
    INFO: '정보',
  },
});

type ErrorCode = CommandFailureCode | SaveErrorCode;

const koErrorLabels: Record<ErrorCode, string> = {
  SCENARIO_MISMATCH: '인시던트 불일치',
  ACTION_NOT_FOUND: '조치 없음',
  ACTION_LOCKED: '잠긴 조치',
  ACTION_REQUIREMENTS_UNMET: '조건 미충족',
  UNSTABLE_REACTIVE_RULES: '불안정한 반응 규칙',
  SAVE_NOT_FOUND: '저장 없음',
  STORAGE_ERROR: '저장소 오류',
  MALFORMED_SAVE: '손상된 저장',
  INCOMPATIBLE_SCHEMA: '호환되지 않는 형식',
  INCOMPATIBLE_CONTENT: '호환되지 않는 콘텐츠',
  REPLAY_MISMATCH: '재현 불일치',
  OVERWRITE_CONFIRMATION_REQUIRED: '교체 확인 필요',
};

// The Korean text is chosen by code. The engine and persistence layers write a
// few fixed English sentences per code; those get their exact Korean wording,
// and any other (parameterised or future) sentence falls back to the code.
const koErrorByCode: Record<ErrorCode, string> = {
  SCENARIO_MISMATCH: '상태와 인시던트 정보가 일치하지 않습니다.',
  ACTION_NOT_FOUND: '해당 조치가 없습니다.',
  ACTION_LOCKED: '아직 잠겨 있는 조치입니다.',
  ACTION_REQUIREMENTS_UNMET: '이 조치의 실행 조건이 아직 충족되지 않았습니다.',
  UNSTABLE_REACTIVE_RULES: '반응 규칙이 안정되지 않아 조치를 적용하지 않았습니다.',
  SAVE_NOT_FOUND: '저장된 기록이 없습니다.',
  STORAGE_ERROR: '로컬 저장소에 접근하지 못했습니다.',
  MALFORMED_SAVE: '저장 데이터가 손상되었거나 형식이 올바르지 않습니다.',
  INCOMPATIBLE_SCHEMA: '지원하지 않는 저장 형식 버전입니다.',
  INCOMPATIBLE_CONTENT: '현재 콘텐츠와 호환되지 않는 저장입니다.',
  REPLAY_MISMATCH: '저장된 상태를 조치 기록으로 재현할 수 없습니다.',
  OVERWRITE_CONFIRMATION_REQUIRED: '저장 슬롯을 교체하기 전에 확인이 필요합니다.',
};

const koErrorBySentence: ReadonlyMap<string, string> = new Map([
  ['State and scenario identity do not match.', '상태와 시나리오 정보가 일치하지 않습니다.'],
  ['The saved session is not valid JSON.', '저장된 세션이 올바른 JSON이 아닙니다.'],
  ['The saved session has no valid envelope.', '저장된 세션의 구조가 올바르지 않습니다.'],
  ['The saved session has no valid schema version.', '저장된 세션에 올바른 형식 버전이 없습니다.'],
  ['This save schema version is not supported.', '지원하지 않는 저장 형식 버전입니다.'],
  ['This save belongs to a different incident.', '다른 인시던트의 저장입니다.'],
  [
    'This save uses an unsupported scenario content version.',
    '지원하지 않는 시나리오 콘텐츠 버전으로 만든 저장입니다.',
  ],
  [
    'The saved session has invalid or missing state fields.',
    '저장된 세션의 상태 필드가 잘못되었거나 빠져 있습니다.',
  ],
  [
    'The saved state and replay metadata disagree.',
    '저장된 상태와 재현 메타데이터가 일치하지 않습니다.',
  ],
  [
    'The saved state cannot be reproduced from its action log.',
    '저장된 상태를 조치 기록으로 재현할 수 없습니다.',
  ],
  [
    'This verified save cannot replay with current content.',
    '검증된 저장이지만 현재 콘텐츠로는 재현할 수 없습니다.',
  ],
  ['The saved session has no incident identifier.', '저장된 세션에 인시던트 식별자가 없습니다.'],
  [
    'The saved session references an unknown incident.',
    '저장된 세션이 알 수 없는 인시던트를 가리킵니다.',
  ],
  ['Campaign progress is not valid JSON.', '캠페인 진행 기록이 올바른 JSON이 아닙니다.'],
  ['Campaign progress schema is not supported.', '지원하지 않는 캠페인 진행 기록 형식입니다.'],
  ['Campaign progress has invalid fields.', '캠페인 진행 기록에 잘못된 필드가 있습니다.'],
  [
    'Local storage could not read the existing session.',
    '로컬 저장소에서 기존 세션을 읽지 못했습니다.',
  ],
  ['Local storage could not save the session.', '로컬 저장소에 세션을 저장하지 못했습니다.'],
  ['Local storage could not read the session.', '로컬 저장소에서 세션을 읽지 못했습니다.'],
  ['No saved session was found.', '저장된 세션이 없습니다.'],
  [
    'Local storage could not read campaign discoveries.',
    '로컬 저장소에서 캠페인 발견 기록을 읽지 못했습니다.',
  ],
  [
    'Local storage could not save campaign discoveries.',
    '로컬 저장소에 캠페인 발견 기록을 저장하지 못했습니다.',
  ],
  ['No completed incident archive was found.', '완료된 인시던트 기록이 없습니다.'],
]);

export interface CodedMessage {
  readonly code: ErrorCode;
  readonly message: string;
}

export function errorLabel(code: ErrorCode, locale: Locale): string {
  return locale === 'ko' ? koErrorLabels[code] : humanize(code);
}

export function errorMessage({ code, message }: CodedMessage, locale: Locale): string {
  if (locale === 'en') return message;
  return koErrorBySentence.get(message) ?? koErrorByCode[code];
}

export function persistenceNoticeText(
  notice: string,
  detail: IncidentPersistenceNoticeDetail | null,
  locale: Locale,
): string {
  if (locale === 'en' || detail === null) return notice;
  switch (detail.code) {
    case 'SESSION_SAVED':
      return '세션을 이 기기에 저장했습니다.';
    case 'SESSION_RESTORED':
      return '저장된 세션을 불러왔습니다.';
    case 'SESSION_MIGRATED':
      return `콘텐츠 ${detail.migratedFromContentVersion ?? ''} 버전의 저장된 세션을 불러왔습니다. 업데이트된 버전을 유지하려면 다시 저장하세요.`;
    case 'ARCHIVE_RESTORED':
      return '캠페인 발견 기록에서 완료된 인시던트를 복원했습니다.';
  }
}
