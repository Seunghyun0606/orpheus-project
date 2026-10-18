import { describe, expect, it } from 'vitest';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import { actTitle, advisorName, endingName, subjectProfile } from './campaign-copy.ts';

describe('advisory naming', () => {
  it('keeps ORPHEUS unnamed until its Act 4 rediscovery', () => {
    expect(advisorName(null)).toBe('Operations advisor');
    expect(advisorName(1)).toBe('Operations advisor');
    expect(advisorName(3)).toBe('Operations advisor');
    expect(advisorName(4)).toBe('ORPHEUS');
    expect(advisorName(9)).toBe('ORPHEUS');
  });

  it('keeps ORPHEUS unnamed in Korean too', () => {
    expect(advisorName(null, 'ko')).toBe('운영 어드바이저');
    expect(advisorName(1, 'ko')).toBe('운영 어드바이저');
    expect(advisorName(3, 'ko')).toBe('운영 어드바이저');
    expect(advisorName(4, 'ko')).toBe('ORPHEUS');
    expect(advisorName(9, 'ko')).toBe('ORPHEUS');
  });
});

describe('Korean campaign copy', () => {
  it('localizes act titles and ending names but keeps English as the default', () => {
    expect(actTitle(7)).toBe('Act 7 — THE BOARD');
    expect(actTitle(7, 'ko')).toBe('7막 — 이사회');
    expect(actTitle(4, 'ko')).toBe('4막 — ORPHEUS');
    expect(actTitle(12, 'ko')).toBe('12막');
    expect(endingName('THE FIRE')).toBe('THE FIRE');
    expect(endingName('THE FIRE', 'ko')).toBe('불');
    expect(endingName('UNLISTED', 'ko')).toBe('UNLISTED');
  });

  it('localizes the subject profile wording only', () => {
    const run = {
      behavior: {
        metrics: {
          restartRate: { status: 'available', value: 0.5, numerator: 1, denominator: 2 },
          averageInvestigationDepth: {
            status: 'available',
            value: 2,
            numerator: 6,
            denominator: 3,
          },
        },
      },
    } as unknown as CampaignRun;
    expect(subjectProfile(run, 'ko')).toEqual([
      { key: 'restartRate', label: '서비스 재시작으로 대응함', value: '50%', detail: '2건 중 1건' },
      {
        key: 'averageInvestigationDepth',
        label: '조사 깊이 (인시던트당 서로 다른 발견 수)',
        value: '2.0',
        detail: '인시던트 3건 기준',
      },
    ]);
    expect(subjectProfile(run)[0]).toMatchObject({
      label: 'Restarted a service as the response',
      detail: '1 of 2',
    });
  });
});
