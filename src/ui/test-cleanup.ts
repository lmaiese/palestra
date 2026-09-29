// Vitest runs without globals, so Testing Library cannot auto-cleanup: do it here.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
