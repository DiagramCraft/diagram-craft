import stub from './empty';
export default stub;
export const WebSocketServer = (...args: unknown[]) => (stub as unknown as (...a: unknown[]) => unknown)(...args);
