import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  TbDots,
  TbFileText,
  TbHistory,
  TbMessage2,
  TbMessageCircle,
  TbMessageOff,
  TbPencil,
  TbTrash,
  TbUpload
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { DropdownMenu } from '../../components/DropdownMenu';
import type { CommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import styles from './MarkdownEditorScreen.module.css';

type MarkdownEditorHeaderActions = {
  onAttachClick: () => void;
  onEnterEdit: () => void;
  onOpenHistory: () => void;
  onRenameRequest: () => void;
  onDeleteRequest: () => void;
};

type CommentsToggle = {
  mode: CommentsDisplayMode;
  /** Unresolved root comment count, shown as a badge. */
  openCount: number;
  onCycle: () => void;
};

const COMMENTS_TOGGLE_META: Record<CommentsDisplayMode, { icon: ReactNode; title: string }> = {
  side: {
    icon: <TbMessageCircle size={13} />,
    title: 'Comments: shown in side panel — click for inline highlights only'
  },
  inline: {
    icon: <TbMessage2 size={13} />,
    title: 'Comments: inline highlights only — click to hide comments'
  },
  off: {
    icon: <TbMessageOff size={13} />,
    title: 'Comments: hidden — click to show in side panel'
  }
};

export const MarkdownEditorHeader = (props: {
  workspaceSlug: string;
  projectId?: string;
  entityId?: string;
  parentLabel: string;
  resolvedTitle: string;
  description: string;
  isViewMode: boolean;
  isDraft?: boolean;
  isUploadingAttachment: boolean;
  attachDisabled: boolean;
  onNavigateBack: () => void;
  actions: MarkdownEditorHeaderActions;
  /** Toggle for how inline comments are displayed; omit/null when the document has none. */
  commentsToggle?: CommentsToggle | null;
}) => {
  const {
    workspaceSlug,
    projectId,
    entityId,
    parentLabel,
    resolvedTitle,
    description,
    isViewMode,
    isDraft = false,
    isUploadingAttachment,
    attachDisabled,
    onNavigateBack,
    actions,
    commentsToggle
  } = props;
  const navigate = useNavigate();

  const homeItem = {
    label: 'Home',
    onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
  };

  const titleBreadcrumb = projectId
    ? [
        homeItem,
        {
          label: 'Projects',
          onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } })
        },
        { label: parentLabel, onClick: onNavigateBack },
        { label: resolvedTitle }
      ]
    : entityId
      ? [
          homeItem,
          {
            label: 'Entities',
            onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } })
          },
          { label: parentLabel, onClick: onNavigateBack },
          { label: resolvedTitle }
        ]
      : [
          homeItem,
          {
            label: 'Workspace Content',
            onClick: () => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } })
          },
          { label: resolvedTitle }
        ];

  const titleIcon = (
    <div className={styles.titleIcon}>
      <TbFileText size={20} />
    </div>
  );

  const titleButtons = (
    <>
      {!isDraft && (
        <>
          <Button
            icon={<TbUpload size={13} />}
            onClick={actions.onAttachClick}
            disabled={isUploadingAttachment || attachDisabled}
          >
            {isUploadingAttachment ? 'Uploading…' : 'Attach file'}
          </Button>
          {commentsToggle && (
            <div className={styles.commentsToggleWrap}>
              <Button
                icon={COMMENTS_TOGGLE_META[commentsToggle.mode].icon}
                title={COMMENTS_TOGGLE_META[commentsToggle.mode].title}
                variant={commentsToggle.mode !== 'off' ? 'primary' : undefined}
                onClick={commentsToggle.onCycle}
              />
              {commentsToggle.openCount > 0 && (
                <span className={styles.commentsToggleBadge}>{commentsToggle.openCount}</span>
              )}
            </div>
          )}
          <Button
            icon={<TbPencil size={13} />}
            onClick={actions.onEnterEdit}
            disabled={!isViewMode}
          >
            Edit
          </Button>
          <DropdownMenu
            trigger={<Button icon={<TbDots size={13} />} disabled={!isViewMode} />}
            items={[
              { label: 'Versions', icon: <TbHistory size={13} />, onClick: actions.onOpenHistory },
              { label: 'Rename', icon: <TbPencil size={13} />, onClick: actions.onRenameRequest },
              {
                label: 'Delete',
                icon: <TbTrash size={13} />,
                danger: true,
                onClick: actions.onDeleteRequest
              }
            ]}
          />
        </>
      )}
    </>
  );

  return (
    <div className={styles.header}>
      <Title
        breadcrumb={titleBreadcrumb}
        icon={titleIcon}
        title={resolvedTitle}
        description={description}
        buttons={titleButtons}
      />
    </div>
  );
};
