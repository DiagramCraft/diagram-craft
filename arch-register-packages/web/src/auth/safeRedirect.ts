/**
 * Returns a safe, same-origin relative path (path + search + hash) for a post-login redirect,
 * or undefined if the value is missing or unsafe.
 */
export const sanitizeRedirect = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  // Must be a single-slash relative path; no protocol-relative URLs, backslashes or control chars
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return undefined;

  try {
    const base = window.location.origin;
    const url = new URL(value, base);
    if (url.origin !== base) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
};
