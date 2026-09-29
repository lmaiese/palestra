// Stroke icons drawn for this app (24px grid, 2px stroke).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconToday = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <rect x="7.5" y="13.5" width="4" height="3.5" rx="0.8" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPlan = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 4h14v16H5z" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </svg>
);

export const IconLog = (p: P) => (
  <svg {...base} {...p} strokeWidth={2.6}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconHistory = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 19.5h16" />
    <path d="M5 15l4.5-4.5 3.5 3L19 7" />
    <path d="M15 7h4v4" />
  </svg>
);

export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconBack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p} strokeWidth={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 7h15M10 4h4M6.5 7l1 13h9l1-13" />
  </svg>
);

export const IconEdit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);

export const IconSand = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="10" r="5" />
    <path d="M7.5 8c2.5 1 6.5 1 9 0M8 12.5c2.5-1 5.5-1 8 0M3 20c3-1.5 6-1.5 9 0s6 1.5 9 0" />
  </svg>
);

export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
  </svg>
);

export const IconRules = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3.5h9l3 3V20.5H6z" />
    <path d="M9 11h6M9 14.5h6M9 18h3" />
  </svg>
);

export const IconGoogle = (p: P) => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" {...p}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
