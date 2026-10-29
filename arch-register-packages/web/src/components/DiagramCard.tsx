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
import styles from './DiagramCard.module.css';
import sharedStyles from './diagram-card-shared.module.css';
import { DiagramMetadataPopover } from './DiagramMetadataPopover';
import { formatDate } from '../utils/dateFormat';

const thumbIconStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  height: '100%',
  padding: 10,
  color: 'var(--accent-fg)'
};

/**
 * Makes a stored preview svg cover its thumbnail (cropping to the thumbnail's aspect ratio)
 * instead of being letterboxed: ensures a viewBox, drops fixed dimensions and sets `slice`.
 */
const coverPreviewSvg = (svg: string): string =>
  svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)?.[1];
    const width = Number.parseFloat(attr('width') ?? '');
    const height = Number.parseFloat(attr('height') ?? '');
    let next = attrs
      .replace(/\s(width|height|preserveAspectRatio)\s*=\s*"[^"]*"/gi, '')
      .replace(/\sstyle\s*=\s*"[^"]*"/i, '');
    if (!attr('viewBox') && width > 0 && height > 0) next += ` viewBox="0 0 ${width} ${height}"`;
    return `<svg${next} preserveAspectRatio="xMidYMid slice">`;
  });

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
      className={sharedStyles.diagramCard}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className={styles.diagramThumb}>
        <div className={styles.diagramThumbNodes}>
          {file.type === 'markdown' || file.type === 'file' ? (
            <div className={styles.diagramThumbIcon} style={thumbIconStyle}>
              {file.type === 'file' ? (
                getFileNodeIcon(file.type, 18, file.original_filename ?? file.name)
              ) : (
                <TbFileText size={18} />
              )}
            </div>
          ) : file.preview_svg ? (
            <>
              <div
                style={{ height: '100%' }}
                dangerouslySetInnerHTML={{ __html: coverPreviewSvg(file.preview_svg) }}
              />
              <div
                className={styles.diagramThumbIcon}
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'flex',
                  padding: 3,
                  borderRadius: 'var(--r-sm)',
                  background: 'color-mix(in srgb, var(--panel-bg) 85%, transparent)',
                  color: 'var(--accent-fg)'
                }}
              >
                <TbSitemap size={18} />
              </div>
            </>
          ) : (
            <div className={styles.diagramThumbIcon} style={thumbIconStyle}>
              <TbSitemap size={18} />
            </div>
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
          <TbFileText size={13} style={{ flexShrink: 0, color: 'var(--accent-fg)' }} />
        )}
        {file.type === 'diagram' && (
          <TbSitemap size={13} style={{ flexShrink: 0, color: 'var(--accent-fg)' }} />
        )}
        {file.type === 'file' && (
          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--accent-fg)' }}>
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
  <button type="button" className={sharedStyles.diagramCard} onClick={onOpen}>
    <div className={styles.diagramThumb}>
      <div className={styles.diagramThumbNodes}>
        <div className={styles.diagramThumbIcon} style={thumbIconStyle}>
          {folder.readOnly ? <TbFolderSymlink size={18} /> : <TbFolder size={18} />}
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
        <TbFolderSymlink size={13} style={{ flexShrink: 0, color: 'var(--accent-fg)' }} />
      ) : (
        <TbFolder size={13} style={{ flexShrink: 0, color: 'var(--accent-fg)' }} />
      )}
      <span>{folder.name}</span>
    </div>
    {showFolder && <div className={styles.diagramRowFolder} />}
    <div className={styles.diagramRowDate}>{folderSummary(folder)}</div>
  </button>
);
