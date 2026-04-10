type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogMeta = Record<string, unknown>;

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
} as const;

function resolveLogLevel(): LogLevel {
  const value = (process.env.LOG_LEVEL || 'info').toLowerCase();

  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[resolveLogLevel()];
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function normalizeMeta(meta?: LogMeta): LogMeta | undefined {
  if (!meta) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(meta, (_key, value) => {
      if (value instanceof Error) {
        return serializeError(value);
      }

      return value;
    })
  ) as LogMeta;
}

function colorFor(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return ANSI.cyan;
    case 'info':
      return ANSI.green;
    case 'warn':
      return ANSI.yellow;
    case 'error':
      return ANSI.red;
  }
}

function formatLevel(level: LogLevel): string {
  return `${colorFor(level)}${level.toUpperCase().padEnd(5)}${ANSI.reset}`;
}

function formatMetaInline(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  const parts = Object.entries(meta).map(([key, value]) => {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    return `${ANSI.gray}${key}${ANSI.reset}=${rendered}`;
  });

  return ` ${parts.join(' ')}`;
}

function writeDev(level: LogLevel, message: string, meta?: LogMeta): void {
  const line =
    `${ANSI.dim}${formatTimestamp()}${ANSI.reset} ` +
    `${formatLevel(level)} ` +
    `${message}` +
    `${formatMetaInline(meta)}`;

  if (level === 'warn' || level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function writeProd(level: LogLevel, message: string, meta?: LogMeta): void {
  const payload = {
    level,
    message,
    timestamp: formatTimestamp(),
    ...(meta ? { meta } : {})
  };

  const line = JSON.stringify(payload);

  if (level === 'warn' || level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  if (!shouldLog(level)) {
    return;
  }

  const normalizedMeta = normalizeMeta(meta);

  if (isProduction()) {
    writeProd(level, message, normalizedMeta);
    return;
  }

  writeDev(level, message, normalizedMeta);
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    write('debug', message, meta);
  },
  info(message: string, meta?: LogMeta): void {
    write('info', message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    write('warn', message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    write('error', message, meta);
  }
};
