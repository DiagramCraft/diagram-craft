import {
  TbCheck,
  TbFolder,
  TbFileText,
  TbFolderSymlink,
  TbMessageCircle,
  TbSitemap,
  TbStar
} from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { getFileNodeIcon } from '../lib/contentNode';
import styles from '../sections/projects/ProjectDetailScreen.module.css';
import { DiagramMetadataPopover } from './DiagramMetadataPopover';
import { formatDate } from '../utils/dateFormat';

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
          {file.type === 'markdown' || file.type === 'file' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--base-fg-more-dim)'
              }}
            >
              {file.type === 'file' ? (
                getFileNodeIcon(file.type, 36, file.original_filename ?? file.name)
              ) : (
                <TbFileText size={36} />
              )}
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
          {formatDate(file.updated_at)}
        </div>
      </div>
    </button>
  </DiagramMetadataPopover>
);

export const DiagramRow = ({
  file,
  folder,
  showFolder = false,
  onOpen,
  onContextMenu
}: {
  file: ProjectFile;
  folder?: string;
  /** Adds the folder column; the list header must show it too. */
  showFolder?: boolean;
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
      className={`${styles.diagramRow} ${showFolder ? styles.diagramRowWithFolder : ''}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className={styles.diagramRowName}>
        {file.type === 'markdown' && (
          <TbFileText size={13} style={{ flexShrink: 0, color: 'var(--base-fg-more-dim)' }} />
        )}
        {file.type === 'diagram' && (
          <TbSitemap size={13} style={{ flexShrink: 0, color: 'var(--base-fg-more-dim)' }} />
        )}
        {file.type === 'file' && (
          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--base-fg-more-dim)' }}>
            {getFileNodeIcon(file.type, 13, file.original_filename ?? file.name)}
          </span>
        )}
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
      {showFolder && (
        <div className={styles.diagramRowFolder}>
          {folder && (
            <>
              <TbFolder size={10} /> {folder}
            </>
          )}
        </div>
      )}
      <div className={styles.diagramRowDate}>{formatDate(file.updated_at)}</div>
    </button>
  </DiagramMetadataPopover>
);

export type DiagramBrowserFolderItem = {
  path: string;
  name: string;
  /** Number of files directly inside the folder */
  fileCount: number;
  readOnly?: boolean;
};

const folderSummary = (folder: DiagramBrowserFolderItem) =>
  `${folder.fileCount} ${folder.fileCount === 1 ? 'item' : 'items'}`;

export const FolderCard = ({
  folder,
  onOpen
}: {
  folder: DiagramBrowserFolderItem;
  onOpen: () => void;
}) => (
  <button type="button" className={styles.diagramCard} onClick={onOpen}>
    <div className={styles.diagramThumb}>
      <div className={styles.diagramThumbGrid} />
      <div className={styles.diagramThumbNodes}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--base-fg-more-dim)'
          }}
        >
          {folder.readOnly ? <TbFolderSymlink size={36} /> : <TbFolder size={36} />}
        </div>
      </div>
    </div>
    <div className={styles.diagramMeta}>
      <div className={styles.diagramName}>
        <span>{folder.name}</span>
      </div>
      <div className={styles.diagramSub}>{folderSummary(folder)}</div>
    </div>
  </button>
);

export const FolderRow = ({
  folder,
  showFolder = false,
  onOpen
}: {
  folder: DiagramBrowserFolderItem;
  showFolder?: boolean;
  onOpen: () => void;
}) => (
  <button
    type="button"
    className={`${styles.diagramRow} ${showFolder ? styles.diagramRowWithFolder : ''}`}
    onClick={onOpen}
  >
    <div className={styles.diagramRowName}>
      {folder.readOnly ? (
        <TbFolderSymlink size={13} style={{ flexShrink: 0, color: 'var(--base-fg-more-dim)' }} />
      ) : (
        <TbFolder size={13} style={{ flexShrink: 0, color: 'var(--base-fg-more-dim)' }} />
      )}
      <span>{folder.name}</span>
    </div>
    {showFolder && <div className={styles.diagramRowFolder} />}
    <div className={styles.diagramRowDate}>{folderSummary(folder)}</div>
  </button>
);
