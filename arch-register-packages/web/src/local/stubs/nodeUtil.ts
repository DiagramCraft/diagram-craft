// `promisify` runs at module level (e.g. gitSource.ts), so it must not throw on load
export const promisify = (_fn: unknown) => () => {
  throw new Error('util.promisify results are not available in the browser demo');
};
export default { promisify };
