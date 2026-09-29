import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Show = (message: string) => void;
const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Show>((text) => {
    setMsg({ text, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!msg) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(timer.current);
  }, [msg]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {msg && (
          <div className="toast" key={msg.id}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {msg.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}
