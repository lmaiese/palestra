import { describe, expect, it } from 'vitest';
import { isOwner, OWNER_EMAIL } from './firebase';

const google = [{ providerId: 'google.com' }];

describe('isOwner', () => {
  it('accepts the verified owner signed in with Google, case-insensitively', () => {
    expect(isOwner({ email: OWNER_EMAIL, emailVerified: true, providerData: google })).toBe(true);
    expect(isOwner({ email: 'MaieseLuigi@Gmail.com', emailVerified: true, providerData: google })).toBe(true);
  });
  it('rejects everyone else', () => {
    expect(isOwner(null)).toBe(false);
    expect(isOwner({ email: null, emailVerified: true, providerData: google })).toBe(false);
    expect(isOwner({ email: OWNER_EMAIL, emailVerified: false, providerData: google })).toBe(false);
    expect(isOwner({ email: 'altro@gmail.com', emailVerified: true, providerData: google })).toBe(false);
    expect(isOwner({ email: OWNER_EMAIL, emailVerified: true, providerData: [{ providerId: 'password' }] })).toBe(false);
  });
});
