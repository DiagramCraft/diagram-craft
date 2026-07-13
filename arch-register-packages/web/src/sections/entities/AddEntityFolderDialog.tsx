import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { useContentScopeOperations } from '../../hooks/useContentScope';

type AddEntityFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  workspaceSlug: string;
  entityId: string;
  parentFolder?: string;
};

export const AddEntityFolderDialog = ({
  open,
  onClose,
  onCreated,
  workspaceSlug,
  entityId,
  parentFolder
}: AddEntityFolderDialogProps) => {
  const { createFolder } = useContentScopeOperations({
    kind: 'entity',
    workspaceId: workspaceSlug,
    entityId
  });

  return (
    <ContentFolderDialog
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      onSubmit={path => createFolder.mutateAsync(path)}
      isPending={createFolder.isPending}
      parentFolder={parentFolder}
      placeholder="e.g. Architecture diagrams"
    />
  );
};
