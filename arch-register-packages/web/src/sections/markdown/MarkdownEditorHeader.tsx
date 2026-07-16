import { useNavigate } from '@tanstack/react-router';
import { TbDots, TbFileText, TbHistory, TbPencil, TbTrash, TbUpload } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { DropdownMenu } from '../../components/DropdownMenu';
import styles from './MarkdownEditorScreen.module.css';

type MarkdownEditorHeaderActions = {
  onAttachClick: () => void;
  onEnterEdit: () => void;
  onOpenHistory: () => void;
  onRenameRequest: () => void;
  onDeleteRequest: () => void;
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
    actions
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
