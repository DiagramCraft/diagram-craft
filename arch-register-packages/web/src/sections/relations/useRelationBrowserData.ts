import { useMemo, useState } from 'react';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import { useRelationsQuery } from '../../hooks/useRelations';
import { useSchemas } from '../../hooks/useSchemas';
import { useEnums } from '../../hooks/useEnums';
import { buildRelationQueryFromFilters, resolveSingleSchemaFilter } from './relationBrowserState';

// Drives the relation-rooted browser (#2689/#2698): a flat filter-condition list (relation's own
// fields, "in"/"out" endpoint entity fields, and a "Type" field for the relation's own schema — see
// relationBrowserState.ts) and the resulting relation list, built on the schema-less `/relations/query`
// endpoint. Table view only for v1 — see RelationBrowser.tsx. There's no separate schema picker:
// "type" is just another filter condition, so the browser can show relations across every schema at
// once. Table columns and own/endpoint-field filtering both need one concrete schema to know which
// fields exist, though, so both fall back to a generic view unless the filters narrow to exactly one
// schema (`activeSchema`, via resolveSingleSchemaFilter).
export const useRelationBrowserData = (workspaceId: string) => {
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const { data: entitySchemas = [] } = useSchemas(workspaceId);
  const { data: enums = [] } = useEnums(workspaceId);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  const relationQuery = useMemo(() => buildRelationQueryFromFilters(conditions), [conditions]);

  const {
    data: relations,
    total,
    isLoading
  } = useRelationsQuery(workspaceId, relationQuery, {
    view: 'full',
    limit: 200,
    offset: 0
  });

  const activeSchemaId = resolveSingleSchemaFilter(conditions);
  const activeSchema = relationSchemas.find(schema => schema.id === activeSchemaId) ?? null;

  return {
    relationSchemas,
    entitySchemas,
    enums,
    conditions,
    setConditions,
    activeSchema,
    relations,
    total: total ?? 0,
    isLoading
  };
};
