import { Link } from '@tanstack/react-router';
import { useRelatedDocumentContent } from '../../../hooks/useDocuments';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../../routes/publicObjectRoutes';
import styles from './EntityOverviewTab.module.css';

const SCOPE_LABEL = { project: 'Project', entity: 'Entity', workspace: 'Workspace' } as const;

/** Renders the typed documents that link to an entity. */
export const RelatedContentBlock = ({
  workspaceSlug,
  entityId
}: {
  workspaceSlug: string;
  entityId: string;
}) => {
  const { data = [] } = useRelatedDocumentContent(workspaceSlug, entityId);

  if (data.length === 0) {
    return (
      <div className={styles.metaPropRow}>
        <span className={`${styles.metaPropValue} ${styles.metaPropMuted}`}>
          No related documents
        </span>
      </div>
    );
  }

  const sorted = [...data].sort(
    (a, b) =>
      (a.document_type_name ?? '').localeCompare(b.document_type_name ?? '') ||
      a.file.name.localeCompare(b.file.name)
  );

  return sorted.map(item => {
    const search = { mode: 'preview' } as const;
    const route =
      item.scope === 'project'
        ? projectMarkdownRoute(
            workspaceSlug,
            asProjectPublicId(item.file.project_public_id ?? item.file.project_id!),
            item.file.id,
            search
          )
        : item.scope === 'entity'
          ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), item.file.id, search)
          : workspaceMarkdownRoute(workspaceSlug, item.file.id, search);
    return (
      <div key={`${item.file.id}:${item.field_id}`} className={styles.projectRow}>
        <Link {...route} className={styles.projectLink}>
          {item.file.name}
        </Link>
        <span className={styles.metaPropValue}>
          {item.field_inverse_name ?? item.field_name}
          <span className={styles.metaPropMuted}> · {SCOPE_LABEL[item.scope]}</span>
        </span>
      </div>
    );
  });
};
