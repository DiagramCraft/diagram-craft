// ── Utility Functions ─────────────────────────────────────────

export const encodeRefs = (refs: string[]): string => refs.join(',');

export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};
