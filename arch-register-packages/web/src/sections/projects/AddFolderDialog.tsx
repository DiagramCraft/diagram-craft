import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { useContentScopeOperations } from '../../hooks/useContentScope';

type AddFolderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  workspaceId: string;
  projectId: string;
  parentFolder?: string;
};

export const AddFolderDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  projectId,
  parentFolder
}: AddFolderDialogProps) => {
  const { createFolder } = useContentScopeOperations({ kind: 'project', workspaceId, projectId });

  return (
    <ContentFolderDialog
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      onSubmit={path => createFolder.mutateAsync(path)}
      isPending={createFolder.isPending}
      parentFolder={parentFolder}
      placeholder="e.g. Current state"
    />
  );
};
