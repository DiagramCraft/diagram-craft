type FetchLike = typeof fetch;

let transport: FetchLike | null = null;

/** Routes `/api` requests through a custom fetch (e.g. an in-browser server). Pass null to reset. */
export const setApiTransport = (fetchLike: FetchLike | null) => {
  transport = fetchLike;
};

const isApiUrl = (url: string) => {
  try {
    return new URL(url, globalThis.location?.href ?? 'http://localhost').pathname.startsWith(
      '/api'
    );
  } catch {
    return false;
  }
};

/** Drop-in replacement for `fetch` that honours the configured API transport. */
export const apiFetch: FetchLike = (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return transport && isApiUrl(url) ? transport(input, init) : fetch(input, init);
};
