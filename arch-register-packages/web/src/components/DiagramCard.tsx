import { TbCheck, TbFolder, TbFileText, TbMessageCircle, TbStar } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import styles from '../sections/projects/ProjectDetailScreen.module.css';
import { DiagramMetadataPopover } from './DiagramMetadataPopover';

const CommentPill = ({ file }: { file: ProjectFile }) => {
  const total = file.comment_count ?? 0;
  const unresolved = file.unresolved_comment_count ?? 0;
  if (total === 0) return null;
  return (
    <span
      className={styles.cmtPill}
      title={
        unresolved > 0
          ? `${unresolved} unresolved of ${total} comment${total === 1 ? '' : 's'}`
          : `${total} comment${total === 1 ? '' : 's'} · all resolved`
      }
    >
      {unresolved > 0 ? (
        <span className={styles.cmtOpen}>
          <span className={styles.cmtOpenDot} />
          {unresolved}
        </span>
      ) : (
        <span className={styles.cmtDone}>
          <TbCheck size={10} />
        </span>
      )}
      <span className={styles.cmtTotal}>
        <TbMessageCircle size={10} />
        {total}
      </span>
    </span>
  );
};

export const DiagramCard = ({
  file,
  folder,
  onOpen,
  onContextMenu
}: {
  file: ProjectFile;
  folder?: string;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) => (
  <DiagramMetadataPopover
    type={file.type}
    fallbackTitle={file.name}
    contentMetadata={file.content_metadata}
    commentCount={file.comment_count}
    unresolvedCommentCount={file.unresolved_comment_count}
  >
    <button
      type="button"
      className={styles.diagramCard}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className={styles.diagramThumb}>
        <div className={styles.diagramThumbGrid} />
        <div className={styles.diagramThumbNodes}>
          {file.type === 'markdown' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--base-fg-more-dim)' }}>
              <TbFileText size={36} />
            </div>
          ) : file.preview_svg ? (
            <div dangerouslySetInnerHTML={{ __html: file.preview_svg }} />
          ) : (
            <svg viewBox="0 0 140 80" preserveAspectRatio="none">
              <rect
                x="10"
                y="14"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="56"
                y="6"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="56"
                y="44"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="100"
                y="26"
                width="32"
                height="18"
                rx="2"
                fill="color-mix(in oklch, var(--tag-component) 28%, var(--cmp-bg))"
                stroke="var(--tag-component)"
              />
              <path
                d="M42 23 L56 15 M42 23 L56 53 M88 15 L100 35 M88 53 L100 35"
                stroke="var(--cmp-fg-disabled)"
                fill="none"
              />
            </svg>
          )}
        </div>
        <CommentPill file={file} />
      </div>
      <div className={styles.diagramMeta}>
        <div className={styles.diagramName}>
          <span>{file.content_metadata?.title ?? file.name}</span>
          <div className={styles.diagramNameBadges}>
            {file.is_workspace_template && (
              <span className={styles.templateBadge} title="Workspace template">
                <TbStar size={10} /> Workspace
              </span>
            )}
            {file.is_template && !file.is_workspace_template && (
              <span className={styles.templateBadge} title="Project template">
                <TbStar size={10} /> Project
              </span>
            )}
          </div>
        </div>
        <div className={styles.diagramSub}>
          {folder && (
            <>
              <TbFolder size={10} /> {folder} &middot;{' '}
            </>
          )}
          {new Date(file.updated_at).toLocaleDateString()}
        </div>
      </div>
    </button>
  </DiagramMetadataPopover>
);

export const DiagramRow = ({
  file,
  folder,
  onOpen,
  onContextMenu
}: {
  file: ProjectFile;
  folder?: string;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) => (
  <DiagramMetadataPopover
    type={file.type}
    fallbackTitle={file.name}
    contentMetadata={file.content_metadata}
    commentCount={file.comment_count}
    unresolvedCommentCount={file.unresolved_comment_count}
  >
    <button
      type="button"
      className={styles.diagramRow}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className={styles.diagramRowName}>
        {file.type === 'markdown' && <TbFileText size={13} style={{ flexShrink: 0, color: 'var(--base-fg-more-dim)' }} />}
        <span>{file.content_metadata?.title ?? file.name}</span>
        {file.is_workspace_template && (
          <span className={styles.templateBadge} title="Workspace template">
            <TbStar size={10} /> Workspace
          </span>
        )}
        {file.is_template && !file.is_workspace_template && (
          <span className={styles.templateBadge} title="Project template">
            <TbStar size={10} /> Project
          </span>
        )}
      </div>
      <div className={styles.diagramRowFolder}>
        {folder && (
          <>
            <TbFolder size={10} /> {folder}
          </>
        )}
      </div>
      <div className={styles.diagramRowDate}>{new Date(file.updated_at).toLocaleDateString()}</div>
    </button>
  </DiagramMetadataPopover>
);
