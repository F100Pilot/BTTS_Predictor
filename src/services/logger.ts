/**
 * Lightweight structured logger.
 * Levels are filtered by VITE_LOG_LEVEL (default: 'info' in dev, 'warn' in prod).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined) ??
  (import.meta.env.DEV ? 'info' : 'warn');

function emit(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (LEVELS[level] < LEVELS[configuredLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta !== undefined ? { meta } : {}),
  };
  const line = `[${entry.ts}] ${level.toUpperCase()} (${scope}) ${message}`;
  /* eslint-disable no-console */
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else if (level === 'info') console.info(line, meta ?? '');
  else console.debug(line, meta ?? '');
  /* eslint-enable no-console */
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit('debug', scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit('info', scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit('warn', scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit('error', scope, msg, meta),
  };
}
