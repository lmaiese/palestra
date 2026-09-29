// Firebase / network errors → short Italian messages. Never show raw traces.

const BY_CODE: Record<string, string> = {
  'permission-denied': 'Permesso negato: accedi di nuovo con l’account del proprietario.',
  unauthenticated: 'Sessione scaduta: accedi di nuovo.',
  unavailable: 'Server non raggiungibile. Sei offline? I dati salvati restano sul telefono e si sincronizzano al ritorno della rete.',
  'deadline-exceeded': 'Il server non ha risposto in tempo. Riprova tra poco.',
  'resource-exhausted': 'Quota giornaliera esaurita. Riprova domani.',
  'failed-precondition': 'Operazione non possibile in questo stato. Ricarica l’app e riprova.',
  'not-found': 'Seduta non trovata: forse è stata eliminata.',
  'already-exists': 'Esiste già una seduta con questo riferimento.',
  aborted: 'Operazione interrotta da un conflitto. Riprova.',
  cancelled: 'Operazione annullata.',
  internal: 'Errore interno del server. Riprova.',
  'invalid-argument': 'Dati non validi: controlla i campi.',
  'auth/network-request-failed': 'Nessuna connessione. Riprova quando sei online.',
  'auth/unauthorized-domain': 'Dominio non autorizzato per l’accesso.',
  'auth/popup-blocked': 'Il browser ha bloccato la finestra di accesso.',
  'auth/too-many-requests': 'Troppi tentativi. Aspetta qualche minuto.',
  'auth/user-disabled': 'Account disabilitato.',
};

export function errorCode(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return '';
  return code.replace(/^firestore\//, '');
}

export function italianError(e: unknown, fallback = 'Qualcosa non ha funzionato. Riprova.'): string {
  const code = errorCode(e);
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return BY_CODE.unavailable;
  return fallback;
}
