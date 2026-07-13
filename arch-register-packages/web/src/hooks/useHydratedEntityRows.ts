import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entityKeys } from '../queries/entities';
import { orpcClient } from '../lib/orpcClient';
import { toEntityListQuery } from './entityListQuery';

type SummaryRow = EntityRecord & { _assessment?: unknown };

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
    queries: schemaIds.map(schemaId => ({
      queryKey: entityKeys.list(workspaceId, { schemaId, view: 'full' }),
      queryFn: () =>
        orpcClient.entities.list({
          params: { workspace: workspaceId },
          query: { ...toEntityListQuery({ schemaId }), view: 'full' }
        }),
      enabled: enabled && !!workspaceId
    }))
  });
  const fullEntities = results.flatMap(result => result.data ?? []);
  return useMemo(() => mergeHydratedEntityRows(rows, fullEntities), [rows, fullEntities]);
};
