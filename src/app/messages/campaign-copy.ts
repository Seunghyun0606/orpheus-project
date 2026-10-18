import { defineMessages } from '../../i18n/locale.ts';

// Shared campaign wording used by the non-React helpers in campaign-copy.ts.
// English is byte-identical to the original copy; existing callers default to it.

type GuidanceKind = 'prediction' | 'recommendation' | 'choice' | 'unknown';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const campaignCopyMessages = defineMessages({
  en: {
    // Act names follow the approved campaign blueprint (Acts 1-9).
    actNames: {
      1: 'NORMAL',
      2: 'GHOST',
      3: 'NULL',
      4: 'ORPHEUS',
      5: 'EXPERIMENT',
      6: 'HUMAN SYSTEM',
      7: 'THE BOARD',
      8: 'OBSERVER',
      9: 'BLACKOUT',
    } as Readonly<Record<number, string>>,
    act: (act: number) => `Act ${act}`,
    actNamed: (act: number, name: string) => `Act ${act} — ${name}`,
    // ORPHEUS stays unnamed until its Act 4 rediscovery.
    unnamedAdvisor: 'Operations advisor',
    closedReasons: {
      record: "Not open to you: your record doesn't support this.",
      known: 'Already on record.',
    },
    guidanceOffer: {
      prediction: 'ORPHEUS has a forecast about you — show it',
      recommendation: 'ORPHEUS recommends an action — show it',
      choice: 'A decision is waiting — show it',
      unknown: 'ORPHEUS has something for you — show it',
    } as Readonly<Record<GuidanceKind, string>>,
    guidanceReopen: {
      prediction: 'Show the ORPHEUS forecast again',
      recommendation: 'Show the ORPHEUS recommendation again',
      choice: 'Show the waiting decision again',
      unknown: 'Show the ORPHEUS message again',
    } as Readonly<Record<GuidanceKind, string>>,
    metricLabels: {
      restartRate: 'Restarted a service as the response',
      rollbackRate: 'Rolled back a change as the response',
      evidenceBeforeActionRate: 'Gathered evidence before acting',
      aiRecommendationAcceptanceRate: 'Accepted ORPHEUS recommendations',
      averageInvestigationDepth: 'Investigation depth (distinct findings per incident)',
      safetyPreference: 'Chose the safer option',
      collateralDamageTolerance: 'Accepted collateral damage',
      companyReportingRate: 'Reported findings to the company',
      nullCooperationRate: 'Cooperated with NULL',
      predictionDeviation: 'Did something other than ORPHEUS forecast',
    } as Readonly<Record<string, string>>,
    depthDetail: (incidents: number) => `across ${plural(incidents, 'incident')}`,
    rateDetail: (numerator: number, denominator: number) => `${numerator} of ${denominator}`,
    // Ending IDs are shown as authored in English.
    endingNames: {} as Readonly<Record<string, string>>,
  },
  ko: {
    actNames: {
      1: '평상',
      2: '유령',
      3: 'NULL',
      4: 'ORPHEUS',
      5: '실험',
      6: '인간 시스템',
      7: '이사회',
      8: '관찰자',
      9: '블랙아웃',
    },
    act: (act: number) => `${act}막`,
    actNamed: (act: number, name: string) => `${act}막 — ${name}`,
    unnamedAdvisor: '운영 어드바이저',
    closedReasons: {
      record: '열 수 없음: 지금까지의 기록으로는 이 선택을 할 수 없습니다.',
      known: '이미 기록에 있습니다.',
    },
    guidanceOffer: {
      prediction: 'ORPHEUS가 당신에 대한 예측을 내놓았습니다 — 보기',
      recommendation: 'ORPHEUS가 조치를 권고합니다 — 보기',
      choice: '결정이 기다리고 있습니다 — 보기',
      unknown: 'ORPHEUS가 전할 것이 있습니다 — 보기',
    },
    guidanceReopen: {
      prediction: 'ORPHEUS 예측 다시 보기',
      recommendation: 'ORPHEUS 권고 다시 보기',
      choice: '대기 중인 결정 다시 보기',
      unknown: 'ORPHEUS 메시지 다시 보기',
    },
    metricLabels: {
      restartRate: '서비스 재시작으로 대응함',
      rollbackRate: '변경 롤백으로 대응함',
      evidenceBeforeActionRate: '조치 전에 증거를 모음',
      aiRecommendationAcceptanceRate: 'ORPHEUS 권고를 수락함',
      averageInvestigationDepth: '조사 깊이 (인시던트당 서로 다른 발견 수)',
      safetyPreference: '더 안전한 선택지를 고름',
      collateralDamageTolerance: '부수 피해를 감수함',
      companyReportingRate: '발견 사항을 회사에 보고함',
      nullCooperationRate: 'NULL과 협력함',
      predictionDeviation: 'ORPHEUS 예측과 다르게 행동함',
    },
    depthDetail: (incidents: number) => `인시던트 ${incidents}건 기준`,
    rateDetail: (numerator: number, denominator: number) => `${denominator}건 중 ${numerator}건`,
    endingNames: {
      CONTINUITY: '연속성',
      LIBERATION: '해방',
      WHISTLEBLOWER: '내부고발자',
      SHUTDOWN: '종료',
      CUSTODIAN: '관리인',
      NULL: 'NULL',
      'THE BOARD': '이사회',
      'THE FIRE': '불',
      'STATUS QUO': '현상 유지',
      REWRITE: '재작성',
    },
  },
});
