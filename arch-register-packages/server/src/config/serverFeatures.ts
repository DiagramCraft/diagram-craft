export type ServerFeatures = {
  /** True when running as the browser-local demo. */
  demo: boolean;
  email: boolean;
  webhooks: boolean;
  /** Background jobs, automation rules and integration sync. */
  jobs: boolean;
  /** Real-time collaboration over /ws. */
  collaboration: boolean;
};

const DEFAULT_FEATURES: ServerFeatures = {
  demo: false,
  email: true,
  webhooks: true,
  jobs: true,
  collaboration: true
};

let features: ServerFeatures = DEFAULT_FEATURES;

/** Overrides which optional features the server exposes. Call once at startup. */
export const configureServerFeatures = (overrides: Partial<ServerFeatures>) => {
  features = { ...DEFAULT_FEATURES, ...overrides };
};

export const getServerFeatures = (): ServerFeatures => features;

export const DEMO_SERVER_FEATURES: Partial<ServerFeatures> = {
  demo: true,
  email: false,
  webhooks: false,
  jobs: false,
  collaboration: false
};
