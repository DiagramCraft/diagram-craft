import type { z } from 'zod';
import type { searchResponseSchema } from './searchContract.js';

// ── Search Response ───────────────────────────────────────────

export type SearchResponse = z.infer<typeof searchResponseSchema>;
