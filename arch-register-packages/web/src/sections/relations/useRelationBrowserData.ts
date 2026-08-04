import { useMemo, useState } from 'react';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import { useRelationsQuery } from '../../hooks/useRelations';

// Drives the relation-rooted browser (#2689): a schema picker plus the resulting relation list,
// built on the new `/relations/query` endpoint. Table view only for v1 — see RelationBrowser.tsx.
export const useRelationBrowserData = (workspaceId: string) => {
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const [schemaId, setSchemaId] = useState<string | null>(null);

  const effectiveSchemaId = schemaId ?? relationSchemas[0]?.id ?? null;

  const relationQuery: EntityQuery | null = useMemo(() => {
    if (!effectiveSchemaId) return null;
    return {
      schemaId: effectiveSchemaId,
      root: { kind: 'and', children: [] }
    };
  }, [effectiveSchemaId]);

  const {
    data: relations,
    total,
    isLoading
  } = useRelationsQuery(workspaceId, relationQuery, {
    view: 'full',
    limit: 200,
    offset: 0
  });

  const activeSchema = relationSchemas.find(schema => schema.id === effectiveSchemaId) ?? null;

  return {
    relationSchemas,
    schemaId: effectiveSchemaId,
    setSchemaId,
    activeSchema,
    relations,
    total: total ?? 0,
    isLoading
  };
};
