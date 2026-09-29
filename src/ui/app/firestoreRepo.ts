// Loaded with a dynamic import only after the owner check: keeps Firestore out of
// the initial chunk and guarantees no query exists for non-owners (DoD S3, C3).
import { createFirestoreRepo } from '../../domain/repo';
import { getDb } from '../../firebase-db';
import type { SessionRepo } from '../../domain/repo';

export function createRepo(): SessionRepo {
  return createFirestoreRepo(getDb());
}
