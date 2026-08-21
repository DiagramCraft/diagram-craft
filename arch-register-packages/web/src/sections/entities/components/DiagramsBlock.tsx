import type { DiagramEntityFile } from '@arch-register/api-types/projectEntityContract';
import { DiagramMetadataPopover } from '../../../components/DiagramMetadataPopover';
import { asProjectPublicId, projectDiagramHref } from '../../../routes/publicObjectRoutes';
import styles from './EntityOverviewTab.module.css';

/** Renders the diagrams an entity appears in. */
export const DiagramsBlock = ({
  workspaceSlug,
  entityDiagramFiles
}: {
  workspaceSlug: string;
  entityDiagramFiles: DiagramEntityFile[];
}) =>
  entityDiagramFiles.length === 0 ? (
    <div className={styles.metaPropRow}>
      <span className={styles.metaPropValue} style={{ color: 'var(--base-fg-more-dim)' }}>
        Not in any diagram
      </span>
    </div>
  ) : (
    <div className={styles.miniDiagramList}>
      {entityDiagramFiles.map(({ file, project }) => (
        <DiagramMetadataPopover
          key={file.id}
          type={file.type}
          fallbackTitle={file.name}
          contentMetadata={file.content_metadata}
          commentCount={file.comment_count}
          unresolvedCommentCount={file.unresolved_comment_count}
        >
          <a
            className={styles.miniDiagramRow}
            href={projectDiagramHref(workspaceSlug, asProjectPublicId(project.public_id), file.id)}
          >
            <div className={styles.miniDiagramThumb}>
              <div className={styles.miniDiagramThumbGrid} />
              {file.preview_svg ? (
                <div
                  className={styles.miniDiagramThumbPreview}
                  dangerouslySetInnerHTML={{ __html: file.preview_svg }}
                />
              ) : (
                <svg
                  className={styles.miniDiagramThumbSvg}
                  viewBox="0 0 60 30"
                  preserveAspectRatio="none"
                >
                  <rect
                    x="3"
                    y="7"
                    width="12"
                    height="7"
                    rx="1"
                    fill="var(--cmp-bg)"
                    stroke="var(--base-fg-more-dim)"
                    strokeWidth="0.7"
                  />
                  <rect
                    x="23"
                    y="3"
                    width="12"
                    height="7"
                    rx="1"
                    fill="var(--cmp-bg)"
                    stroke="var(--base-fg-more-dim)"
                    strokeWidth="0.7"
                  />
                  <rect
                    x="23"
                    y="20"
                    width="12"
                    height="7"
                    rx="1"
                    fill="var(--cmp-bg)"
                    stroke="var(--base-fg-more-dim)"
                    strokeWidth="0.7"
                  />
                  <rect
                    x="43"
                    y="10"
                    width="12"
                    height="7"
                    rx="1"
                    fill="color-mix(in oklch, var(--tag-component) 28%, var(--cmp-bg))"
                    stroke="var(--tag-component)"
                    strokeWidth="0.7"
                  />
                  <path
                    d="M15 10 L23 6 M15 11 L23 23 M35 6 L43 14 M35 23 L43 14"
                    stroke="var(--cmp-fg-disabled)"
                    fill="none"
                    strokeWidth="0.7"
                  />
                </svg>
              )}
            </div>
            <div className={styles.miniDiagramBody}>
              <div className={styles.miniDiagramName}>
                {file.content_metadata?.title ?? file.name}
              </div>
              <div className={styles.miniDiagramSub}>{project.name}</div>
            </div>
          </a>
        </DiagramMetadataPopover>
      ))}
    </div>
  );
