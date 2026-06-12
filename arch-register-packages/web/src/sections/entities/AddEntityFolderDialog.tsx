import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { useCreateEntityFolder } from '../../hooks/useProjects';

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
  const createFolderMutation = useCreateEntityFolder(workspaceSlug, entityId);

  return (
    <ContentFolderDialog
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      onSubmit={path => createFolderMutation.mutateAsync(path)}
      isPending={createFolderMutation.isPending}
      parentFolder={parentFolder}
      placeholder="e.g. Architecture diagrams"
    />
  );
};
