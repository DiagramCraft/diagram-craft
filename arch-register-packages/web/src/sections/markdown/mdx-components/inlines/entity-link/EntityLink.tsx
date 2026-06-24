import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { entityDetailRoute, asEntityPublicId } from '../../../../../routes/publicObjectRoutes';
import styles from './EntityLink.module.css';

export const EntityLink = ({ id }: { id: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);
  const navigate = useNavigate();

  if (!id) return null;

  if (isLoading) {
    return (
      <span className={styles.linkLoading}>
        {id}
      </span>
    );
  }

  if (isError || !entity) {
    return (
      <span className={styles.linkUnavailable}>
        not found
      </span>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(id)));
  };

  return (
    <a
      href="#"
      className={styles.link}
      onClick={handleClick}
    >
      {entity._name}
    </a>
  );
};
