import stub from './empty';
export default stub;
export const readdirSync = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
export const readFileSync = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
export const statSync = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
export const createWriteStream = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
