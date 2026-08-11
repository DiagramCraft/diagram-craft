import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { hydratedEntitiesBySchemaQuery } from '../queries/entities';

type SummaryRow = EntityRecord & { _assessment?: unknown };

export const filterEntityRowsBySchema = <T extends SummaryRow>(
  rows: T[],
  schemaId?: string | null
): T[] => (schemaId == null ? rows : rows.filter(row => row._schema.id === schemaId));

export const mergeHydratedEntityRows = <T extends SummaryRow>(
  rows: T[],
  fullEntities: EntityRecord[]
): T[] => {
  const byId = new Map(fullEntities.map(entity => [entity._uid, entity]));
  return rows.map(row => {
    const full = byId.get(row._uid);
    return full ? ({ ...full, _assessment: row._assessment } as T) : row;
  });
};

export const useHydratedEntityRows = <T extends SummaryRow>(
  workspaceId: string,
  rows: T[],
  enabled = true
) => {
  const schemaIds = useMemo(() => [...new Set(rows.map(row => row._schema.id))], [rows]);
  const results = useQueries({
    queries: schemaIds.map(schemaId =>
      hydratedEntitiesBySchemaQuery(workspaceId, schemaId, enabled)
    )
  });
  const fullEntities = results.flatMap(result => result.data ?? []);
  return useMemo(() => mergeHydratedEntityRows(rows, fullEntities), [rows, fullEntities]);
};
