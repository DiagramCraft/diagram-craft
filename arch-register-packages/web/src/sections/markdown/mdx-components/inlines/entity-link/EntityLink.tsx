import { Link } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { entityDetailRoute, asEntityPublicId } from '../../../../../routes/publicObjectRoutes';
import { HoverCard } from '../../../../../components/HoverCard';
import { EntityHoverCardBody } from '../../../../../components/EntityHoverCardBody';
import styles from './EntityLink.module.css';

export const EntityLink = ({ id }: { id: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);

  if (!id) return null;

  if (isLoading) {
    return <span className={styles.linkLoading}>{id}</span>;
  }

  if (isError || !entity) {
    return <span className={styles.linkUnavailable}>not found</span>;
  }

  return (
    <HoverCard
      content={
        <EntityHoverCardBody
          name={entity._name}
          description={entity._description}
          schemaName={entity._schema?.name}
          tags={entity._tags}
        />
      }
    >
      <Link
        {...entityDetailRoute(workspaceSlug, asEntityPublicId(id))}
        className={styles.link}
        onClick={event => event.stopPropagation()}
      >
        {entity._name}
      </Link>
    </HoverCard>
  );
};
