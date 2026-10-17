import { describe, expect, it } from 'vitest';
import { advisorName } from './campaign-copy.ts';

describe('advisory naming', () => {
  it('keeps ORPHEUS unnamed until its Act 4 rediscovery', () => {
    expect(advisorName(null)).toBe('Operations advisor');
    expect(advisorName(1)).toBe('Operations advisor');
    expect(advisorName(3)).toBe('Operations advisor');
    expect(advisorName(4)).toBe('ORPHEUS');
    expect(advisorName(9)).toBe('ORPHEUS');
  });
});
