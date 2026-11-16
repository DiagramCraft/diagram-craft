/** True in the browser-local demo build (VITE_DEMO_MODE=true). Fixed at build time. */
export const isDemoMode = import.meta.env['VITE_DEMO_MODE'] === 'true';
