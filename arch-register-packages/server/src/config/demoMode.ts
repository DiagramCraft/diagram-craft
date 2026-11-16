let demoMode = false;

/**
 * Marks the server as running the browser-local demo (no jobs, email, webhooks or
 * collaboration). Call once at startup, from the demo Worker entry.
 */
export const configureDemoMode = (enabled: boolean) => {
  demoMode = enabled;
};

export const isDemoMode = (): boolean => demoMode;
