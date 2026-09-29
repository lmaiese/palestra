# Palestra

App personale per consultare il **Piano 8 Settimane v2** (28 set → 22 nov 2026) e registrare gli allenamenti: data, esercizi, kg per set, reps e RPE opzionali, conditioning e note. Un solo utente (`maieseluigi@gmail.com`), costo zero.

Live: https://palestra-luigi.web.app · Specifica e Definition of Done: [SPEC.md](SPEC.md)

## Stack

- Vite + React 19 + TypeScript (strict), router a hash, PWA (manifest + service worker)
- Firebase JS SDK modulare: Auth (solo Google) e Firestore con cache persistente IndexedDB
- Firebase Hosting (progetto `palestra-luigi`, piano Spark)
- Test: Vitest (+ Testing Library), `@firebase/rules-unit-testing` sull'emulatore, Playwright + axe per l'e2e
- Lint: oxlint

## Struttura

| Percorso | Contenuto |
|----------|-----------|
| `data/piano_8_settimane_v2.md` | Il piano, fonte originale |
| `scripts/parse-plan.ts` | Parser markdown → `src/data/plan.json` (committato, deterministico) |
| `src/domain/` | Logica pura: piano, esercizi canonici, date, validazione, statistiche, id sedute, repo |
| `src/firebase.ts`, `src/firebase-db.ts` | App + Auth; Firestore caricato in modo lazy dopo il controllo owner |
| `src/ui/` | Schermate e componenti |
| `firestore.rules`, `tests/rules/` | Regole di sicurezza e relativi test |
| `scripts/seed.ts`, `scripts/size.ts`, `scripts/emu.sh` | Seed produzione, controllo peso bundle, emulatori con Java 21 |

## Setup

Requisiti:

- Node 22+ e npm
- Firebase CLI (`npm i -g firebase-tools`) per emulatori e deploy
- **Java 21+** per gli emulatori. `scripts/emu.sh` lo cerca da solo (`$JAVA_HOME_21`, `~/homebrew/opt/openjdk@21`, `/opt/homebrew/opt/openjdk@21`, `java_home -v 21`) senza toccare il `JAVA_HOME` globale; se non c'è: `brew install openjdk@21`
- `gcloud` autenticato solo per il seed di produzione

```sh
npm install
npm run dev        # app contro Firebase di produzione (serve il login owner)
npm run dev:emu    # app contro gli emulatori (VITE_USE_EMULATORS=1, progetto demo-palestra)
```

Per `dev:emu` avvia prima gli emulatori, ad esempio `scripts/emu.sh --only auth,firestore 'sleep 86400'` oppure `firebase emulators:start --only auth,firestore --project demo-palestra` con Java 21 nel PATH.

## Comandi npm

| Comando | Cosa fa |
|---------|---------|
| `npm run dev` / `npm run dev:emu` | Server di sviluppo Vite (produzione / emulatori) |
| `npm run build` | `tsc -b` + build Vite in `dist/` |
| `npm run preview` | Serve `dist/` in locale |
| `npm run typecheck` | Controllo tipi di tutto il progetto |
| `npm run lint` | oxlint |
| `npm test` / `npm run test:watch` | Unit e component test (Vitest) |
| `npm run coverage` | Test con copertura; soglia 90% righe su `src/domain` |
| `npm run test:rules` | Test delle regole Firestore sull'emulatore (via `scripts/emu.sh`) |
| `npm run e2e` | Playwright sugli emulatori auth + firestore |
| `npm run plan` | Rigenera `src/data/plan.json` dal markdown (`git diff --exit-code src/data/plan.json` deve restare pulito) |
| `npm run size` | Peso gzip dei JS in `dist/assets`; fallisce sopra 350 KB |
| `npm run seed` | Crea i due allenamenti iniziali in produzione (vedi sotto) |
| `npm run verify` | Tutto in fila: typecheck, lint, test, test:rules, build, size, e2e |

## Deploy

```sh
npm run verify
npm run build && firebase deploy --only hosting,firestore:rules,auth
```

Dopo il deploy: `curl -sI https://palestra-luigi.web.app` (header di sicurezza, `no-cache` su `/`), `curl -sI` su un file di `/assets/` (`immutable`), e una lettura REST non autenticata di `sessions` deve dare `PERMISSION_DENIED`.

## Seed

I due allenamenti fatti prima dell'app (`2026-09-25-w1-C`, `2026-09-28-w1-A`, definiti in `src/domain/seed.ts`) si scrivono in produzione via REST con il token di `gcloud` (credenziali IAM: le regole non si applicano):

```sh
npm run seed -- --dry-run   # mostra cosa scriverebbe
npm run seed                # crea solo se mancano; rilanciato stampa "già presente"
```

## Modello di sicurezza

- **Solo il proprietario.** Le regole Firestore permettono lettura e scrittura su `sessions/*` solo se il token ha `email == maieseluigi@gmail.com`, `email_verified == true` e `sign_in_provider == google.com`. Ogni altro percorso è negato. La UI fa lo stesso controllo (`isOwner`) e senza owner non esegue query.
- **Validazione dei documenti** in `firestore.rules`, specchio di `validateSession`: chiavi ammesse, tipi, range (kg 0–500, reps 0–100, RPE 1–10, corpo libero = 0 kg con reps ≥ 1), testi ≤ 2000, massimo 30 esercizi e 20 set, formato dell'id, `createdAt` immutabile e `updatedAt` = ora del server.
  **Limite noto:** le regole non hanno cicli e hanno un budget di 1000 espressioni per richiesta; per restarci dentro validano i campi di primo livello, la dimensione delle liste, la forma dei **primi 2 esercizi** e i valori dei loro **primi 2 set**. Il resto è garantito lato client da `validateSession`. Dato che scrive solo il proprietario, è una difesa contro bug del client, non contro attaccanti. Un documento massimo (30 × 20) è testato come accettato.
- **API key del browser** ristretta per referrer a `palestra-luigi.web.app`, `palestra-luigi.firebaseapp.com` e `localhost`. La config web Firebase è pubblica per design: la sicurezza sta nelle regole.
- **Header HTTP** (Hosting): CSP restrittiva (script solo da sé stessi, `apis.google.com`, `www.gstatic.com`; frame solo Google accounts e l'auth domain), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. I percorsi riservati `/__/*` (handler di login) restano con gli header di Firebase.
- **Logout** con `signOutAndClear()`: chiude Firestore e cancella la cache IndexedDB, così sul dispositivo non restano dati.
- Nel bundle di produzione non c'è codice per gli emulatori (`grep` su `dist/` per `127.0.0.1` e `demo-palestra`: nessun risultato).

## Modello di costo

- Piano **Spark senza billing account**: il costo effettivo è zero e non può crescere.
- Nessuna Cloud Function, Storage o Realtime Database (`firebase.json` contiene solo `auth`, `hosting`, `firestore`, `emulators`).
- **Il piano è nel bundle** (`plan.json`): consultarlo non legge Firestore, e le schermate del piano non importano Firestore.
- **Un solo listener** su `sessions` condiviso da tutta l'app e **cache persistente** IndexedDB: le riaperture sono servite dalla cache e funzionano offline.
- Asset con hash in cache per un anno (`immutable`), `index.html` in `no-cache`. Bundle JS ≤ 350 KB gzip (`npm run size`).
