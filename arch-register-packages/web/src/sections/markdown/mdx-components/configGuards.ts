/** Small value guards shared by components' `isValidConfig` implementations. */

export const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const isOptionalBoolean = (value: unknown): boolean =>
  value === undefined || typeof value === 'boolean';

export const isOptionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

export const isOptionalStringArray = (value: unknown): boolean =>
  value === undefined || (Array.isArray(value) && value.every(item => typeof item === 'string'));

/** `config[key]` is absent or a string. */
export const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  isOptionalString(config[key]);

/** `config[key]` is absent or a whole number. */
export const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));
