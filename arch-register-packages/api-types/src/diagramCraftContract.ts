import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from './common';

// ── Shared sub-schemas ────────────────────────────────────────

const diagramCraftSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string()
      })
      .passthrough()
  )
});

const diagramCraftEntitySchema = z.record(z.string(), z.unknown());

// ── Contract ──────────────────────────────────────────────────

export const diagramCraftContract = {
  diagramCraft: {
    listSchemas: oc
      .route({ method: 'GET', path: '/public/{workspace}/schemas', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(diagramCraftSchemaSchema)),
    listData: oc
      .route({ method: 'GET', path: '/public/{workspace}/data', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(diagramCraftEntitySchema))
  }
};
