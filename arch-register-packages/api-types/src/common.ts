import { z } from 'zod';

// ── Common Types ──────────────────────────────────────────────

export const ws = z.object({
  workspace: z.string()
});

export const wsAndId = z.object({
  workspace: z.string(),
  id: z.string()
});
