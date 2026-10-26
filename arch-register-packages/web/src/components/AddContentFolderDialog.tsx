import { ContentFolderDialog } from './ContentFolderDialog';
import { useContentScopeOperations, type ContentScope } from '../hooks/useContentScope';

/** Creates a folder in the content of a project, entity or the workspace. */
export const AddContentFolderDialog = ({
  scope,
  ...dialogProps
}: {
  scope: ContentScope;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentFolder?: string;
  placeholder?: string;
}) => {
  const { createFolder } = useContentScopeOperations(scope);

  return (
    <ContentFolderDialog
      {...dialogProps}
      onSubmit={path => createFolder.mutateAsync(path)}
      isPending={createFolder.isPending}
    />
  );
};
