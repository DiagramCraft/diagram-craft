import stub from './empty';
export default stub;
export const isIP = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
