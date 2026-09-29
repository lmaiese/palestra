export function Denied({ email, onRetry }: { email: string; onRetry: () => void }) {
  return (
    <main className="gate gate-denied">
      <div className="gate-inner">
        <svg className="denied-mark" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" />
          <path d="M14 50L50 14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <h1 className="gate-title gate-title-sm">Accesso negato</h1>
        <p className="gate-lede">
          <strong className="denied-email">{email}</strong> non è autorizzato. Account disconnesso, nessun dato
          letto.
        </p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Usa un altro account
        </button>
      </div>
    </main>
  );
}
