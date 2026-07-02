import { useNavigate } from '@tanstack/react-router';
import { TbDots, TbFileText, TbHistory, TbPencil, TbTrash, TbUpload } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { DropdownMenu } from '../../components/DropdownMenu';
import type { MarkdownEditorScreenState } from './MarkdownEditorScreen.state';
import styles from './MarkdownEditorScreen.module.css';

export const MarkdownEditorHeader = (props: {
  workspaceSlug: string;
  projectId?: string;
  entityId?: string;
  parentLabel: string;
  resolvedTitle: string;
  screenState: MarkdownEditorScreenState;
  revisionsCount: number;
  updatedLabel: string | null;
  readTime: number;
  isUploadingAttachment: boolean;
  onNavigateBack: () => void;
  onAttachClick: () => void;
  onEnterEdit: () => void;
  onOpenHistory: () => void;
  onRenameRequest: () => void;
  onDeleteRequest: () => void;
}) => {
  const {
    workspaceSlug,
    projectId,
    entityId,
    parentLabel,
    resolvedTitle,
    screenState,
    revisionsCount,
    updatedLabel,
    readTime,
    isUploadingAttachment,
    onNavigateBack,
    onAttachClick,
    onEnterEdit,
    onOpenHistory,
    onRenameRequest,
    onDeleteRequest
  } = props;
  const navigate = useNavigate();

  const homeItem = {
    label: 'Home',
    onClick: () => navigate({ to: '/$workspaceSlug/', params: { workspaceSlug } })
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

  const titleDescription =
    screenState.screenMode === 'edit'
      ? 'Editing now'
      : screenState.viewPanel === 'history'
        ? `Version history${revisionsCount > 0 ? ` · ${revisionsCount} saved` : ''}`
        : [updatedLabel ? `Updated ${updatedLabel}` : null, `${readTime} min read`]
            .filter(Boolean)
            .join(' · ');

  const isViewMode = screenState.screenMode === 'preview' && screenState.viewPanel === 'preview';

  const titleButtons = (
    <>
      <Button
        icon={<TbUpload size={13} />}
        onClick={onAttachClick}
        disabled={isUploadingAttachment || screenState.viewPanel === 'history'}
      >
        {isUploadingAttachment ? 'Uploading…' : 'Attach file'}
      </Button>
      <Button icon={<TbPencil size={13} />} onClick={onEnterEdit} disabled={!isViewMode}>
        Edit
      </Button>
      <DropdownMenu
        trigger={<Button icon={<TbDots size={13} />} disabled={!isViewMode} />}
        items={[
          { label: 'Versions', icon: <TbHistory size={13} />, onClick: onOpenHistory },
          { label: 'Rename', icon: <TbPencil size={13} />, onClick: onRenameRequest },
          {
            label: 'Delete',
            icon: <TbTrash size={13} />,
            danger: true,
            onClick: onDeleteRequest
          }
        ]}
      />
    </>
  );

  return (
    <div className={styles.header}>
      <Title
        breadcrumb={titleBreadcrumb}
        icon={titleIcon}
        title={resolvedTitle}
        description={titleDescription}
        buttons={titleButtons}
      />
    </div>
  );
};
