// ── Common Types ──────────────────────────────────────────────

export type ForeignKey<T = string> = {
  id: string;
  name: T;
};
