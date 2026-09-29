# Palestra — SPEC e Definition of Done

App personale per consultare il Piano 8 Settimane v2 e registrare gli allenamenti (data, esercizi, kg).
Un solo utente: `maieseluigi@gmail.com`. Costo: zero effettivo.

- Firebase project: `palestra-luigi` (piano Spark, **nessun billing account collegato**)
- URL: https://palestra-luigi.web.app
- Firestore: `(default)` in `europe-west8`
- Auth: solo Google Sign-In (provisioning in `firebase.json`, blocco `auth`)
- Stack: Vite + React 19 + TypeScript, Firebase JS SDK modulare, Vitest, Playwright

## Architettura

| Cosa | Dove | Perché |
|------|------|--------|
| Piano 8 settimane | `data/piano_8_settimane_v2.md` → `scripts/parse-plan.ts` → `src/data/plan.json` (committato, bundled) | Consultare il piano costa 0 letture Firestore |
| Allenamenti registrati | Firestore `sessions/{sessionId}` | Unica cosa che vive nel DB |
| Cache | Firestore `persistentLocalCache` (IndexedDB) | Riaperture dell'app servite dalla cache, funziona offline |
| Hosting | Firebase Hosting, `dist/` | Gratuito su Spark |

Niente Cloud Functions, niente Storage, niente Realtime Database: su Spark non servono e sono superficie d'attacco o di costo.

## Contratto tra i moduli

Tipi: `src/domain/types.ts` (fonte di verità). Funzioni che il dominio espone e la UI consuma:

```ts
// src/domain/plan.ts
export const plan: Plan;                                   // da src/data/plan.json
export function getWeek(n: number): PlanWeek | undefined;
export function getSession(week: number, day: DayId): PlanSession | undefined;
export function weekForDate(isoDate: string): number | null; // 1..8 dentro il ciclo, null fuori
export function defaultDayForDate(isoDate: string): DayId | null; // lun→A, mar→B, ven→C, altri null

// src/domain/exercises.ts
export function canonicalExerciseId(rawName: string): string;  // "Back Squat TEST 3RM"→"back-squat", "DL"→"deadlift", "Pallor press"→"pallof-press"
export function exerciseDisplayName(exerciseId: string): string;

// src/domain/validation.ts  (specchio delle regole Firestore)
export function validateSession(input: WorkoutSessionInput): string[]; // [] = valida, altrimenti messaggi in italiano

// src/domain/stats.ts
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string):
  { date: string; sessionId: string; topKg: number; sets: LoggedSet[] }[]; // cronologico
export function personalBest(sessions: WorkoutSession[], exerciseId: string): { kg: number; date: string } | null;
export function lastLoad(sessions: WorkoutSession[], exerciseId: string, beforeDate?: string): { kg: number; date: string } | null;
export function weekCompletion(sessions: WorkoutSession[], week: number): Record<DayId, WorkoutSession | null>;
export function sessionFromPlan(week: number, day: DayId, date: string): WorkoutSessionInput; // precompila esercizi (sets vuoti)

// src/domain/sessionId.ts
export function sessionIdFor(date: string, week: number | null, day: DayId | null): string; // "2026-09-28-w1-A", "2026-09-30-extra"

// src/domain/seed.ts
export const seedSessions: WorkoutSession[]; // i due allenamenti già fatti

// src/domain/repo.ts
export interface SessionRepo {
  subscribe(onData: (s: WorkoutSession[]) => void, onError: (e: Error) => void): () => void;
  save(input: WorkoutSessionInput, id?: string): Promise<string>;
  remove(id: string): Promise<void>;
}
export function createFirestoreRepo(db: Firestore): SessionRepo;
export function createMemoryRepo(initial?: WorkoutSession[]): SessionRepo; // per test e UI dev

// src/firebase.ts
export const OWNER_EMAIL = 'maieseluigi@gmail.com';
export function isOwner(user: { email: string | null; emailVerified: boolean; providerData: { providerId: string }[] } | null): boolean;
```

## Dati iniziali (seed)

| id | data | piano | contenuto |
|----|------|-------|-----------|
| `2026-09-25-w1-C` | 2026-09-25 | Sett 1, C | Hang Power Clean 50; Deadlift 70; Bulgarian Split Squat 30 ×2 set. Conditioning: 3 × (250 m row + swing 20 kg). Note: "Ridotto perché giocavo a beach" |
| `2026-09-28-w1-A` | 2026-09-28 | Sett 1, A | Back Squat 70 @RPE 7; Hip Thrust 70; Pallof Press 20 |

Reps non registrate = `null`. La seduta del 25/09 è precedente all'inizio ufficiale del ciclo (28/09): il riferimento settimana/giorno è esplicito sul documento, non derivato dalla data.

## Definition of Done

Ogni voce ha un comando o un controllo che la verifica. Il loop si chiude solo con tutte le voci verdi.

### Funzionalità (F)

| ID | Criterio | Verifica |
|----|----------|----------|
| F1 | Il parser estrae 8 settimane × 3 sedute; date settimana 1 = 2026-09-28→10-04, settimana 8 = 11-16→11-22; 5 anchor; tema di ogni settimana; tabella progressione (7 righe); pool tecnica | `npm test` (test su `plan.json` generato e sul parser) |
| F2 | `plan.json` è rigenerabile e identico a quello committato | `npm run plan && git diff --exit-code src/data/plan.json` |
| F3 | Canonicalizzazione: stesso esercizio = stesso id tra piano e log, alias abbreviati inclusi (HPC, DL, Hip trust, Pallor press, Bulgarian) | unit test con tabella di casi |
| F4 | Consulto piano: tutte le 8 settimane navigabili, ogni seduta mostra blocco, esercizio, set×reps, recupero, note; anchor evidenziati; tecnica dell'esercizio consultabile; regole (C-Lite, Beach > Pesi, progressione, warm-up, gestione fatica) consultabili | component test + e2e |
| F5 | Registrazione: data (default oggi), settimana/giorno dedotti dalla data e modificabili, esercizi precompilati dal piano, kg per set, reps e RPE opzionali, aggiungi/rimuovi set ed esercizi extra, conditioning e note; salva; modifica; elimina con conferma | component test + e2e sull'emulatore |
| F6 | Accanto a ogni esercizio in registrazione e nel piano: ultimo carico usato ("ultima volta 70 kg · 28/09") | component test |
| F7 | Storico: elenco sedute in ordine cronologico inverso; pagina esercizio con grafico del carico massimo nel tempo e record personale | unit test su `stats.ts` + component test |
| F8 | Dashboard: settimana corrente del ciclo, seduta suggerita per oggi, completamento A/B/C della settimana, ultimi carichi dei 5 anchor | component test |
| F9 | Validazione input: kg 0–500, reps 0–100 o null, RPE 1–10 o null, data ISO valida, max 30 esercizi e 20 set per esercizio, testi ≤ 2000 caratteri; errori mostrati in italiano | unit test |
| F10 | Seed: i due allenamenti sono in Firestore di produzione con i valori della tabella sopra; lo script è idempotente | `npm run seed` due volte + lettura REST dei documenti |
| F11 | Funziona offline dopo il primo caricamento (cache Firestore persistente) e si installa in home (manifest + icone) | ispezione `dist/manifest.webmanifest` + e2e |

### Sicurezza (S)

| ID | Criterio | Verifica |
|----|----------|----------|
| S1 | Regole Firestore: lettura/scrittura su `sessions/*` solo se `auth.token.email == maieseluigi@gmail.com`, `email_verified == true`, `firebase.sign_in_provider == 'google.com'`. Ogni altro path negato | `npm run test:rules` sull'emulatore: anonimo, altro account Google, email non verificata, stesso indirizzo con provider password → tutti negati; owner ammesso |
| S2 | Le regole validano la forma del documento (chiavi ammesse, tipi, range, dimensioni) come `validateSession` | `npm run test:rules` con documenti malformati |
| S3 | La UI non esegue query se l'utente non è owner: mostra "accesso negato" e fa logout | component test |
| S4 | API key browser ristretta per referrer a `palestra-luigi.web.app`, `palestra-luigi.firebaseapp.com`, `localhost` | `gcloud services api-keys describe` |
| S5 | Header di sicurezza in hosting: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS | `curl -sI https://palestra-luigi.web.app` |
| S6 | Richiesta REST non autenticata a `sessions` → `PERMISSION_DENIED` in produzione | `curl` sull'endpoint Firestore REST |
| S7 | Nessun segreto nel repo (la config web Firebase è pubblica per design); nessun codice di test/emulatore nel bundle di produzione | `grep` su `dist/` per `emulator`, `127.0.0.1`, `__test` |

### Costo (C)

| ID | Criterio | Verifica |
|----|----------|----------|
| C1 | Nessun billing account sul progetto | `gcloud billing projects describe palestra-luigi` → `billingEnabled: false` |
| C2 | Nessuna Function, nessuno Storage bucket usato, nessun RTDB | `firebase.json` contiene solo `auth`, `hosting`, `firestore`, `emulators` |
| C3 | Consultare il piano non importa Firestore (0 letture) | test che le route del piano non dipendono da `firebase/firestore` + e2e con network log |
| C4 | Una sola query di lettura all'avvio (`sessions`, listener unico condiviso), cache persistente | code review + unit test del repo |
| C5 | Asset con hash: `Cache-Control: public, max-age=31536000, immutable`; `index.html`: `no-cache` | `curl -sI` |
| C6 | Bundle JS totale ≤ 350 KB gzip | `npm run build` + script `size` |

### Frontend (UI)

| ID | Criterio | Verifica |
|----|----------|----------|
| UI1 | Mobile-first: a 375 px nessuno scroll orizzontale su ogni schermata | Playwright: `scrollWidth <= clientWidth` su tutte le route |
| UI2 | Target touch ≥ 44 px su bottoni e input | Playwright: bounding box di ogni elemento interattivo |
| UI3 | Input numerici con `inputmode="decimal"`, ogni input ha una label accessibile | component test + axe |
| UI4 | Zero violazioni axe `serious`/`critical` | Playwright + `@axe-core/playwright` su tutte le route |
| UI5 | Design system in variabili CSS (colori, spaziature, raggi, tipografia), tema scuro di default e tema chiaro coerente | ispezione `src/ui/styles` |
| UI6 | Stati loading, vuoto ed errore su ogni schermata con dati | component test |
| UI7 | Revisione visiva indipendente degli screenshot 375 px e 1280 px: gerarchia chiara, niente look da template, tipografia curata, numeri (kg) leggibili a colpo d'occhio. Voto ≥ 8/10 del revisore su ogni schermata | screenshot in `docs/screenshots/` + report del revisore |

### Qualità (Q)

| ID | Criterio | Verifica |
|----|----------|----------|
| Q1 | `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rules`, `npm run build`, `npm run e2e` verdi | CI locale: `npm run verify` |
| Q2 | Copertura righe `src/domain` ≥ 90% | `npm run coverage` |
| Q3 | README con setup, comandi, deploy, modello di sicurezza e di costo | lettura |

### Deploy (D)

| ID | Criterio | Verifica |
|----|----------|----------|
| D1 | App live su https://palestra-luigi.web.app, `200`, contiene il titolo dell'app | `curl` sul contenuto, non solo sullo status |
| D2 | Regole Firestore deployate = `firestore.rules` del repo | `firebase deploy --only firestore:rules` + S6 |
