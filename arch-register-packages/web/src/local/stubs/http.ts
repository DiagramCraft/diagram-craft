import stub from './empty';
export default stub;
export const request = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
export const createServer = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
