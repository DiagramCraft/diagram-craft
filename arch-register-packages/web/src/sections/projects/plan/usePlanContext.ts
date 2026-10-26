import { useMemo } from 'react';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';

export type PlanSchemaInfo = { color: string; icon: string | null };

// Workspace configuration shared by the Plan tabs.
export const usePlanContext = () => {
  const { schemas, lifecycleStates, teams } = useWorkspaceContext();
  const schemaMap = useMemo(
    () =>
      new Map<string, PlanSchemaInfo>(
        schemas.map((schema, index) => [
          schema.id,
          { color: resolveSchemaColor(schema, index), icon: schema.icon ?? null }
        ])
      ),
    [schemas]
  );
  return { schemas, lifecycleStates, teams, schemaMap };
};
