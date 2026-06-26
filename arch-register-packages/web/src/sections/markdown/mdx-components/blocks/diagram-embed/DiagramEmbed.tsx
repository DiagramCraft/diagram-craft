import { useNavigate, useParams } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useProjectFile } from '../../../../../hooks/useProjectFiles';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDiagramRoute,
  projectDiagramRoute
} from '../../../../../routes/publicObjectRoutes';
import styles from './DiagramEmbed.module.css';

export const DiagramEmbed = ({ id, caption }: { id: string; caption?: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: file, isLoading, isError } = useProjectFile(workspaceSlug, id);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { projectId?: string; entityId?: string };

  if (!id) return null;

  const handleClick = () => {
    if (!file) return;
    if (file.project_public_id) {
      void navigate(projectDiagramRoute(workspaceSlug, asProjectPublicId(file.project_public_id), file.id));
    } else if (params.entityId) {
      void navigate(entityDiagramRoute(workspaceSlug, asEntityPublicId(params.entityId), file.id));
    } else {
      void navigate({
        to: '/$workspaceSlug/content/diagrams/$diagramId',
        params: { workspaceSlug, diagramId: file.id }
      });
    }
  };

  if (isLoading) {
    return (
      <figure className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </figure>
    );
  }

  if (isError || !file) {
    return (
      <figure className={`${styles.container} ${styles.error}`}>
        <span className={styles.errorText}>Diagram not found: {id}</span>
      </figure>
    );
  }

  if (!file.preview_svg) {
    return (
      <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
        <span className={styles.empty}>No preview available</span>
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is server-generated */}
      <div className={styles.svgWrapper} dangerouslySetInnerHTML={{ __html: file.preview_svg }} />
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
};
