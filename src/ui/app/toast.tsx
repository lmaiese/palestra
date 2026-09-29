import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}
type Show = (message: string, action?: ToastAction) => void;
const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Show>((text, action) => {
    setMsg({ text, id: Date.now(), action });
  }, []);

  useEffect(() => {
    if (!msg) return;
    clearTimeout(timer.current);
    // Longer when there is something to undo.
    timer.current = setTimeout(() => setMsg(null), msg.action ? 6000 : 3200);
    return () => clearTimeout(timer.current);
  }, [msg]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {msg && (
          <div className={`toast${msg.action ? ' toast-action' : ''}`} key={msg.id}>
            {!msg.action && (
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span>{msg.text}</span>
            {msg.action && (
              <button
                type="button"
                className="toast-btn"
                onClick={() => {
                  msg.action!.onClick();
                  setMsg(null);
                }}
              >
                {msg.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}
