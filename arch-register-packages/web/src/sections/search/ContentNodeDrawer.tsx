import { Button } from '@diagram-craft/app-components/Button';
import { useNavigate } from '@tanstack/react-router';
import type { ProjectFileSearchResult } from '@arch-register/api-types/searchContract';
import { Chip } from '../../components/Chip';
import { Drawer } from '../../components/Drawer';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDiagramRoute,
  entityMarkdownRoute,
  projectDiagramRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import styles from '../governance/GovernanceCaseDrawer.module.css';
import { getFileContextLabel, getFileFolder } from './searchScreenHelpers';

/**
 * Read-only drawer summarising a diagram or wiki page, opened from a search result. Hosted in the
 * workspace drawer stack (see `useEntityDrawer`); `node` is the search result row itself.
 */
export const ContentNodeDrawer = ({
  workspaceSlug,
  node,
  onClose,
  active,
  stacked,
  stackOffset
}: {
  workspaceSlug: string;
  node: ProjectFileSearchResult;
  onClose: () => void;
  active?: boolean;
  stacked?: boolean;
  stackOffset?: number;
}) => {
  const navigate = useNavigate();
  const isWiki = node.type === 'markdown';
  const metadata = node.content_metadata;
  const projectId = node.projectPublicId ?? node.projectId;

  const open = () => {
    if (node.scope === 'project' && projectId) {
      const id = asProjectPublicId(projectId);
      navigate(
        isWiki
          ? projectMarkdownRoute(workspaceSlug, id, node.fileId)
          : projectDiagramRoute(workspaceSlug, id, node.fileId)
      );
    } else if (node.scope === 'entity' && node.entityPublicId) {
      const id = asEntityPublicId(node.entityPublicId);
      navigate(
        isWiki
          ? entityMarkdownRoute(workspaceSlug, id, node.fileId)
          : entityDiagramRoute(workspaceSlug, id, node.fileId)
      );
    } else if (node.scope === 'workspace') {
      navigate(
        isWiki
          ? workspaceMarkdownRoute(workspaceSlug, node.fileId)
          : {
              to: '/$workspaceSlug/content/diagrams/$diagramId' as const,
              params: { workspaceSlug, diagramId: node.fileId }
            }
      );
    }
    onClose();
  };

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>{label}</span>
        <span>{value}</span>
      </div>
    ) : null;

  return (
    <Drawer
      onClose={onClose}
      active={active}
      stacked={stacked}
      stackOffset={stackOffset}
      eyebrow={<span className="dim mono">{isWiki ? 'Wiki page' : 'Diagram'}</span>}
      title={metadata?.title ?? node.name}
      badges={<Chip tone="ghost">{getFileContextLabel(node)}</Chip>}
      footer={
        <Button variant="primary" onClick={open}>
          {isWiki ? 'Open page' : 'Open diagram'}
        </Button>
      }
    >
      {metadata?.description && (
        <>
          <div className={styles.sectionLabel}>Description</div>
          <div>{metadata.description}</div>
        </>
      )}
      <div className={styles.sectionLabel}>Details</div>
      {row('Name', node.name)}
      {row('Location', getFileContextLabel(node))}
      {row('Folder', getFileFolder(node.path))}
      {row('Company', metadata?.company)}
      {row('Category', metadata?.category)}
      {row('Comments', `${node.comment_count} (${node.unresolved_comment_count} unresolved)`)}
      {metadata && metadata.keywords.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Keywords</div>
          <div>
            {metadata.keywords.map(keyword => (
              <Chip key={keyword} tone="ghost">
                {keyword}
              </Chip>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
};
