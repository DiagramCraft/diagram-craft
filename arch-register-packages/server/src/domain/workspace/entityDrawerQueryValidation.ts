import {
  ENTITY_DRAWER_QUERY_METADATA_FIELDS,
  type EntityDrawerQueryValidator
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { WorkspaceEnumDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import {
  parseAndValidateEntityQueryText,
  type EnumCatalog
} from '../catalog/entityQueryTextCompiler';
import {
  resolveEntityQueryRootKind,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from '../catalog/entityQueryIRResolution';
import { resolveProjectionPathSchemaInfo } from '../catalog/entityQueryIRPlan';

type EntityDrawerQueryValidationCatalog = {
  schemas: SchemaCatalog;
  enums: EnumCatalog;
  relationSchemas: RelationSchemaCatalog;
};

export type EntityDrawerQueryValidationCatalogInput = {
  schemas: SchemaDbResult[];
  enums: WorkspaceEnumDbResult[];
  relationSchemas: RelationSchemaDbResult[];
};

const escapeQueryStringLiteral = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const supportedMetadataFieldIds = new Set<string>(
  ENTITY_DRAWER_QUERY_METADATA_FIELDS.map(field => field.id)
);

const toCatalog = (
  input: EntityDrawerQueryValidationCatalogInput
): EntityDrawerQueryValidationCatalog => ({
  schemas: new Map(input.schemas.map(schema => [schema.id, schema])),
  enums: new Map(input.enums.map(enumValue => [enumValue.id, enumValue])),
  relationSchemas: new Map(input.relationSchemas.map(schema => [schema.id, schema]))
});

const parseDrawerQuery = (
  queryText: string,
  schemaName: string,
  catalog: EntityDrawerQueryValidationCatalog,
  authCtx: WorkspaceAuthorizationContext | null
) => {
  const prefix = `schema:"${escapeQueryStringLiteral(schemaName)}" _id = "__drawer_validation__" columns path `;
  return {
    queryOffset: prefix.length,
    result: parseAndValidateEntityQueryText(
      `${prefix}${queryText} as "value"`,
      catalog.schemas,
      catalog.enums,
      authCtx,
      catalog.relationSchemas
    )
  };
};

const targetSchemasForQuery = (
  query: EntityQuery,
  ownerSchemaId: string,
  catalog: EntityDrawerQueryValidationCatalog
): SchemaDbResult[] => {
  const projection = query.projections?.[0];
  if (!projection) return [];

  // The wrapper fixes the query root through a schema predicate. Pinning schemaId here gives the
  // path planner the same concrete root scope while retaining the IR returned by the shared text
  // parser.
  const scopedQuery = { ...query, schemaId: ownerSchemaId };
  const rootKind = resolveEntityQueryRootKind(
    scopedQuery,
    catalog.schemas,
    catalog.relationSchemas
  ).rootKind;
  const pathInfo = resolveProjectionPathSchemaInfo(
    projection.path,
    scopedQuery,
    rootKind,
    catalog.schemas,
    catalog.relationSchemas
  );
  return pathInfo.terminalEntitySchemaIds.flatMap(schemaId => {
    const schema = catalog.schemas.get(schemaId);
    return schema ? [schema] : [];
  });
};

export const createEntityDrawerQueryValidator = (
  input: EntityDrawerQueryValidationCatalogInput,
  authCtx: WorkspaceAuthorizationContext | null
): EntityDrawerQueryValidator => {
  const catalog = toCatalog(input);

  return ({ item, schema }) => {
    const parsed = parseDrawerQuery(item.queryText, schema.name, catalog, authCtx);
    if (!parsed.result.ok) {
      return parsed.result.errors
        .map(
          error =>
            `Query text at offset ${Math.max(0, error.offset - parsed.queryOffset)}: ${error.message}`
        )
        .join('; ');
    }

    const targetSchemas = targetSchemasForQuery(parsed.result.query, schema.id, catalog);
    if (targetSchemas.length === 0) {
      return 'The query path does not resolve to an entity target schema.';
    }

    const targetSchemaNames = targetSchemas.map(targetSchema => targetSchema.name).join(', ');
    for (const configuredField of item.fields ?? []) {
      const fieldId = configuredField.fieldId.trim();
      if (fieldId !== configuredField.fieldId) {
        return `Result field '${configuredField.fieldId}' must not contain leading or trailing whitespace.`;
      }
      if (supportedMetadataFieldIds.has(fieldId)) continue;

      const available = targetSchemas.some(targetSchema =>
        targetSchema.fields.some(field => field.id === fieldId && field.archived !== true)
      );
      if (!available) {
        return `Result field '${configuredField.fieldId}' is not an active field on any query target schema (${targetSchemaNames}) or a supported metadata field.`;
      }
    }

    return null;
  };
};
