type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

let activeLevel: LogLevel = 'debug';

export const setLogLevel = (level: LogLevel) => {
  activeLevel = level;
};

const isEnabled = (level: LogLevel) => LEVELS[level] >= LEVELS[activeLevel];

const format = (level: LogLevel, ns: string, msg: string) =>
  `[${level.toUpperCase()}] [${ns}] ${msg}`;

const extra = (context?: unknown) => (context !== undefined ? [context] : []);

export const createLogger = (ns: string) => ({
  trace: (msg: string, context?: unknown) => {
    if (isEnabled('trace')) console.log(format('trace', ns, msg), ...extra(context));
  },
  debug: (msg: string, context?: unknown) => {
    if (isEnabled('debug')) console.log(format('debug', ns, msg), ...extra(context));
  },
  info: (msg: string, context?: unknown) => {
    if (isEnabled('info')) console.log(format('info', ns, msg), ...extra(context));
  },
  warn: (msg: string, context?: unknown) => {
    if (isEnabled('warn')) console.warn(format('warn', ns, msg), ...extra(context));
  },
  error: (msg: string, context?: unknown) => {
    if (isEnabled('error')) console.error(format('error', ns, msg), ...extra(context));
  }
});
