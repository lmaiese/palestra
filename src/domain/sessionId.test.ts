import { describe, expect, it } from 'vitest';
import { SESSION_ID_RE, sessionIdFor, uniqueSessionId } from './sessionId';

describe('sessionIdFor', () => {
  it('builds planned and extra ids', () => {
    expect(sessionIdFor('2026-09-28', 1, 'A')).toBe('2026-09-28-w1-A');
    expect(sessionIdFor('2026-09-30', null, null)).toBe('2026-09-30-extra');
    expect(sessionIdFor('2026-09-30', 1, null)).toBe('2026-09-30-extra');
  });
  it('disambiguates taken ids', () => {
    expect(uniqueSessionId('a', new Set())).toBe('a');
    expect(uniqueSessionId('a', new Set(['a', 'a-2']))).toBe('a-3');
  });
  it('matches the id pattern', () => {
    expect(SESSION_ID_RE.test('2026-09-28-w1-A')).toBe(true);
    expect(SESSION_ID_RE.test('2026-09-30-extra-2')).toBe(true);
    expect(SESSION_ID_RE.test('2026-09-30-w9-A')).toBe(false);
  });
});
