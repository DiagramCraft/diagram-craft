// ── Utility Functions ─────────────────────────────────────────

const normalizeRef = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const encodeRefs = (refs: string[]): string[] =>
  refs.map(normalizeRef).filter((value): value is string => value != null);

export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map(normalizeRef).filter((value): value is string => value != null);
  }
  return String(raw)
    .split(',')
    .map(normalizeRef)
    .filter((value): value is string => value != null);
};
