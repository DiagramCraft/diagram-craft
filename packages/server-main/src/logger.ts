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

export const createLogger = (ns: string) => ({
  trace: (msg: string) => {
    if (isEnabled('trace')) console.log(format('trace', ns, msg));
  },
  debug: (msg: string) => {
    if (isEnabled('debug')) console.log(format('debug', ns, msg));
  },
  info: (msg: string) => {
    if (isEnabled('info')) console.log(format('info', ns, msg));
  },
  warn: (msg: string) => {
    if (isEnabled('warn')) console.warn(format('warn', ns, msg));
  },
  error: (msg: string, err?: unknown) => {
    if (isEnabled('error')) console.error(format('error', ns, msg), ...(err !== undefined ? [err] : []));
  }
});
