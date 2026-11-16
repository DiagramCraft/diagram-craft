import { useAuthConfig } from './useAuthConfig';

export type ServerFeatures = {
  demo: boolean;
  email: boolean;
  webhooks: boolean;
  jobs: boolean;
  collaboration: boolean;
};

// Used until the auth config has loaded, or if the server does not report features
const DEFAULT_FEATURES: ServerFeatures = {
  demo: false,
  email: true,
  webhooks: true,
  jobs: true,
  collaboration: true
};

export const useServerFeatures = (): ServerFeatures => {
  const { data } = useAuthConfig();
  return data?.features ?? DEFAULT_FEATURES;
};
