import { useEffect, useId, useRef } from 'react';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation for destructive actions. Focus starts on "Annulla". */
export function ConfirmDialog({ title, body, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-b`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="dialog-title">
          {title}
        </h2>
        <p id={`${id}-b`} className="dialog-body">
          {body}
        </p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-quiet" onClick={onCancel}>
            Annulla
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Elimino…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
