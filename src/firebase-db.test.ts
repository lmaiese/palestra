import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const fsMock = vi.hoisted(() => ({
  initializeFirestore: vi.fn(() => ({ tag: 'db' })),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  terminate: vi.fn(),
  clearIndexedDbPersistence: vi.fn(),
}));
vi.mock('firebase/firestore', () => fsMock);
vi.mock('firebase/auth', () => ({ signOut: vi.fn(async () => calls.push('signOut')) }));
vi.mock('./firebase', () => ({ getFirebaseApp: () => ({}), getAuthInstance: () => ({ tag: 'auth' }) }));

const { getDb, signOutAndClear } = await import('./firebase-db');

describe('firebase-db', () => {
  beforeEach(() => {
    calls.length = 0;
    fsMock.initializeFirestore.mockClear();
    fsMock.terminate.mockImplementation(async () => {
      calls.push('terminate');
    });
    fsMock.clearIndexedDbPersistence.mockImplementation(async () => {
      calls.push('clear');
    });
  });

  it('memoizes the Firestore instance with a persistent multi-tab cache', () => {
    expect(getDb()).toBe(getDb());
    expect(fsMock.persistentMultipleTabManager).toHaveBeenCalled();
    expect(fsMock.connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('signOutAndClear terminates, clears the cache, signs out and resets the instance', async () => {
    getDb();
    await signOutAndClear();
    expect(calls).toEqual(['terminate', 'clear', 'signOut']);
    getDb();
    expect(fsMock.initializeFirestore).toHaveBeenCalledTimes(1); // re-created after the reset
  });

  it('signs out even if clearing the cache fails', async () => {
    fsMock.clearIndexedDbPersistence.mockImplementationOnce(async () => {
      throw new Error('failed-precondition');
    });
    await expect(signOutAndClear()).rejects.toThrow('failed-precondition');
    expect(calls).toEqual(['terminate', 'signOut']);
  });
});
