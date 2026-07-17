import type { ReactNode } from 'react';
import { useEntity } from '../hooks/useEntities';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { HoverCard } from './HoverCard';
import { EntityHoverCardBody } from './EntityHoverCardBody';

/**
 * Zero-config entity hover card: fetches the entity by id and renders the
 * default body. For contexts that already have the entity data loaded, use
 * `HoverCard` + `EntityHoverCardBody` directly instead to avoid a duplicate fetch.
 */
export const EntityHoverCard = ({
  entityId,
  children
}: {
  entityId: string;
  children: ReactNode;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, entityId);

  return (
    <HoverCard
      disabled={isLoading || isError || !entity}
      content={
        entity ? (
          <EntityHoverCardBody
            name={entity._name}
            description={entity._description}
            schemaName={entity._schema?.name}
            tags={entity._tags}
          />
        ) : null
      }
    >
      {children}
    </HoverCard>
  );
};
