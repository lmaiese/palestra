import type { ReactNode } from 'react';

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface Props {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  detail?: ReactNode;
  action?: Action;
}

/** Inline loading / empty / error block used by every data-driven section. */
export function StateBlock({ kind, title, detail, action }: Props) {
  return (
    <div
      className={`state state-${kind}`}
      role={kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined}
      aria-busy={kind === 'loading' || undefined}
    >
      {kind === 'loading' && <span className="state-bar" aria-hidden="true" />}
      <p className="state-title">{title}</p>
      {detail && <p className="state-detail">{detail}</p>}
      {action &&
        (action.href ? (
          <a className="btn btn-quiet" href={action.href}>
            {action.label}
          </a>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

export function FullPageState(props: Props) {
  return (
    <main className="fullpage">
      <StateBlock {...props} />
    </main>
  );
}
