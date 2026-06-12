import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { useCreateFolder } from '../../hooks/useProjectFiles';

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
  const createFolderMutation = useCreateFolder(workspaceId, projectId);

  return (
    <ContentFolderDialog
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      onSubmit={path => createFolderMutation.mutateAsync(path)}
      isPending={createFolderMutation.isPending}
      parentFolder={parentFolder}
      placeholder="e.g. Current state"
    />
  );
};
