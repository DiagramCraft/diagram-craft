const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Date-only strings (YYYY-MM-DD) are parsed as local midnight to avoid a
// UTC-midnight timezone shift landing on the wrong calendar day.
const toDate = (value: unknown): Date | null => {
  if (value == null || value === '') return null;
  const str = String(value);
  const date = DATE_ONLY_RE.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value: unknown, fallback = '—'): string => {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : fallback;
};

export const formatDateTime = (value: unknown, fallback = '—'): string => {
  const date = toDate(value);
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : fallback;
};

export const formatRelativeTime = (value: unknown, fallback = '—'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};
