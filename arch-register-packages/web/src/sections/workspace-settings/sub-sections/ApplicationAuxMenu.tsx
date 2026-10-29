import { useState } from 'react';
import { TbTrash } from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TitleMenu } from '../../../components/TitleMenu';
import { useApplications, useDeleteApplication } from '../../../hooks/useApplications';

/** Overflow (…) menu for the screen header with application-level actions, currently "Delete application". */
export const ApplicationAuxMenu = ({
  workspaceSlug,
  applicationKey,
  onDeleted
}: {
  workspaceSlug: string;
  applicationKey: string;
  onDeleted: () => void;
}) => {
  const { data: applications } = useApplications(workspaceSlug);
  const application = applications?.find(candidate => candidate.key === applicationKey);
  const deleteApplication = useDeleteApplication(workspaceSlug);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!application) return null;

  return (
    <>
      <TitleMenu
        label="Application actions"
        items={[
          {
            label: 'Delete application',
            icon: <TbTrash size={14} />,
            danger: true,
            onClick: () => setDeleteOpen(true)
          }
        ]}
      />
      <DeleteConfirmationDialog
        open={deleteOpen}
        title="Delete application?"
        message={
          <>
            The application <b>{application.name}</b> and all of its dashboards will be permanently
            deleted.
          </>
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteApplication.mutate(application.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              onDeleted();
            },
            onError: () => setDeleteOpen(false)
          })
        }
      />
    </>
  );
};
