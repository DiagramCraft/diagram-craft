import type { QueryClient } from '@tanstack/react-query';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { WORKSPACE } from '../../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { schemasQuery } from '../../../queries/schemas';
import { relationSchemasQuery } from '../../../queries/relationSchemas';

export const API_SCHEMA_ID = 'story-api-schema';
export const DATA_FLOW_RELATION_SCHEMA_ID = 'story-data-flow-schema';

/**
 * Story fixtures for the API & Integration Catalog panels (#3459) — every panel resolves the
 * `api-specification` capability config and the workspace's schemas/relation-schemas internally
 * (see `useResolvedApiIntegrationCatalogConfig.ts`/`useDataFlowConfig.ts`), so any story rendering
 * one of these panels needs those base queries seeded even when the panel's own props make the
 * resolved values irrelevant to what's displayed — otherwise React Query attempts a real network
 * fetch against a nonexistent backend.
 */
export const apiSchemaFixture = {
  id: API_SCHEMA_ID,
  name: 'API',
  icon: 'api',
  entity_count: 12,
  fields: []
} as unknown as EntitySchema;

export const seedApiCapabilityConfig = (client: QueryClient) =>
  client.setQueryData(workspaceCapabilityConfigurationsQuery(WORKSPACE).queryKey, [
    {
      type: 'api-specification',
      valid: true,
      bindings: { api: { target: { kind: 'entity_schema', id: API_SCHEMA_ID } } }
    }
  ] as unknown as WorkspaceCapabilityConfiguration[]);

export const seedSchemas = (client: QueryClient, schemas: EntitySchema[] = [apiSchemaFixture]) =>
  client.setQueryData(schemasQuery(WORKSPACE).queryKey, schemas);

/** `configured: false` (the default) leaves the workspace with no "Data Flow" relation schema,
 *  matching `useDataFlowConfig`'s "not configured" branch. */
export const seedDataFlowRelationSchema = (client: QueryClient, configured: boolean) =>
  client.setQueryData(
    relationSchemasQuery(WORKSPACE).queryKey,
    (configured
      ? [{ id: DATA_FLOW_RELATION_SCHEMA_ID, name: 'Data Flow', fields: [] }]
      : []) as unknown as RelationSchema[]
  );
