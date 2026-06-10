import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const diagramCraftSchemaFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string()
}).passthrough();

const diagramCraftSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(diagramCraftSchemaFieldSchema)
});

const diagramCraftEntitySchema = z.record(z.string(), z.unknown());

// ── Contract ──────────────────────────────────────────────────

export const diagramCraftContract = {
  diagramCraft: {
    listSchemas: oc
      .route({ method: 'GET', path: '/public/{workspace}/schemas' })
      .input(z.object({ workspace: z.string() }))
      .output(z.array(diagramCraftSchemaSchema)),
    listData: oc
      .route({ method: 'GET', path: '/public/{workspace}/data' })
      .input(z.object({ workspace: z.string() }))
      .output(z.array(diagramCraftEntitySchema))
  }
};
