export type ErrorMetadata = Record<string, unknown> & {
  expected?: boolean;
};

export const isExpectedError = (error: { data?: unknown }): boolean => {
  const { data } = error;
  return typeof data === 'object' && data !== null && 'expected' in data && data.expected === true;
};
