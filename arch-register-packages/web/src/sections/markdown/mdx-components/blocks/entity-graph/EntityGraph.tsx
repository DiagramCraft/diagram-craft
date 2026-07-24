import { Link, useNavigate } from '@tanstack/react-router';
import { Banner } from '../../../../../components/Banner';
import { LoadingState } from '../../../../../components/LoadingState';
import { useEntity } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../../../routes/publicObjectRoutes';
import { EntityGraphView } from '../../../../entities/components/EntityGraphView';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  type EntityGraphDirection
} from './types';
import styles from './EntityGraph.module.css';

type Props = {
  id: string;
  depth?: string;
  direction?: string;
};

export const EntityGraph = ({ id, depth, direction }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const normalizedDepth = normalizeEntityGraphDepth(depth);
  const normalizedDirection: EntityGraphDirection = normalizeEntityGraphDirection(direction);
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);

  if (!id) return <Banner variant="error">EntityGraph requires an entity id.</Banner>;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingState text="Loading entity graph…" size="sm" />
      </div>
    );
  }

  if (isError || !entity) {
    return <Banner variant="error">Entity not found or you do not have access: {id}</Banner>;
  }

  const onEntityClick = (entityId: string) => {
    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
  };

  return (
    <div className={styles.container}>
      <EntityGraphView
        workspaceId={workspaceSlug}
        rootEntityId={entity._uid}
        rootEntityName={entity._name ?? entity._slug}
        rootEntitySchemaId={entity._schema.id}
        schemas={schemas}
        onEntityClick={onEntityClick}
        readOnly
        maxDepth={normalizedDepth}
        direction={normalizedDirection}
        fullGraphLink={
          <Link
            {...entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId), {
              tab: 'graph'
            })}
          >
            View full graph →
          </Link>
        }
      />
    </div>
  );
};
