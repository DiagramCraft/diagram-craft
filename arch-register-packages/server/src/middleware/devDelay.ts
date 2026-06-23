import { defineHandler } from 'h3';
import { createLogger } from '../utils/logger';

const logger = createLogger('dev-delay');

const parseDelayValue = (name: string, rawValue: string | undefined) => {
  if (rawValue === undefined || rawValue.trim() === '') {
    return 0;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value &lt; 0) {
    logger.warn(`Ignoring invalid ${name} value "${rawValue}", expected a non-negative number`);
    return 0;
  }

  return value;
};

const sleep = (delayMs: number) =>
  new Promise(resolve =&gt; {
    setTimeout(resolve, delayMs);
  });

export const createDevDelayMiddleware = () =&gt; {
  const isDev = process.env.NODE_ENV === 'development';
  const avgDelay = parseDelayValue('DEV_API_DELAY_MS', process.env.DEV_API_DELAY_MS);
  const variance = parseDelayValue(
    'DEV_API_DELAY_VARIANCE_MS',
    process.env.DEV_API_DELAY_VARIANCE_MS
  );

  if (!isDev || avgDelay === 0) {
    return defineHandler(() =&gt; {});
  }

  logger.info(`API delay middleware enabled: ${avgDelay}ms ±${variance}ms`);

  return defineHandler(async () =&gt; {
    const randomizedDelay = avgDelay + (Math.random() * 2 - 1) * variance;
    const actualDelay = Math.max(0, randomizedDelay);
    await sleep(actualDelay);
  });
};
