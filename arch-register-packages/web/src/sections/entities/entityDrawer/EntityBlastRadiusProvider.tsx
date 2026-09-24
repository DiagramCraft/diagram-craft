import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useBlastRadius, DEFAULT_BLAST_RADIUS_DEPTH } from '../../../hooks/useBlastRadius';
import { EntityBlastRadiusDialog } from './EntityBlastRadiusDialog';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from './EntityDrawerProviderRegistry';

const EntityBlastRadiusProvider = ({ context }: EntityDrawerProviderProps) => {
  const [open, setOpen] = useState(false);
  const { data: lifecycleStates = [] } = useLifecycleStates(context.workspaceId);
  const subject = { kind: 'entity' as const, entityId: context.entity._uid };
  const { status, entities } = useBlastRadius(context.workspaceId, subject, {
    maxDepth: DEFAULT_BLAST_RADIUS_DEPTH,
    ownerId: null,
    schemaIds: null,
    viaSchemaIds: null
  });

  return (
    <EntityDrawerProviderStatus
      state={status === 'loading' ? 'loading' : status === 'error' ? 'unavailable' : 'ready'}
      unavailableMessage="Blast radius is unavailable."
    >
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {entities.length === 0
          ? 'No directly impacted entities'
          : `${entities.length} directly impacted ${entities.length === 1 ? 'entity' : 'entities'}`}
      </Button>
      <EntityBlastRadiusDialog
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={context.workspaceId}
        entityId={context.entity._uid}
        entityName={context.entity._name}
        schemas={context.schemas}
        lifecycleStates={lifecycleStates}
      />
    </EntityDrawerProviderStatus>
  );
};

export const entityBlastRadiusDrawerProviderDefinitions = [
  {
    slotId: 'entity.blast-radius',
    supports: (_context: EntityDrawerProviderContext) => true,
    Component: EntityBlastRadiusProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
