type ApiUrlTarget = string | URL;

const getApiBaseUrl = () => {
  const configuredBase = (import.meta.env.VITE_API_URL ?? '').trim();
  if (configuredBase) {
    return configuredBase.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost';
};

export const resolveApiUrl = (target: ApiUrlTarget): string => {
  const targetString = target instanceof URL ? target.toString() : target;

  try {
    return new URL(targetString).toString();
  } catch {
    // Relative API paths are resolved below against the configured API prefix.
  }

  return new URL(targetString.replace(/^\/+/, ''), `${getApiBaseUrl()}/`).toString();
};
