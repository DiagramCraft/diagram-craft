import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useProjectFile } from '../../../../../hooks/useProjectFiles';
import styles from './DiagramEmbed.module.css';

export const DiagramEmbed = ({ id, caption }: { id: string; caption?: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: file, isLoading, isError } = useProjectFile(workspaceSlug, id);

  if (!id) return null;

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
      <figure className={styles.container}>
        <span className={styles.empty}>No preview available</span>
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className={styles.container}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is server-generated */}
      <div className={styles.svgWrapper} dangerouslySetInnerHTML={{ __html: file.preview_svg }} />
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
};
