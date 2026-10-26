import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  ProjectFormFields,
  toProjectRequestBody,
  type ProjectFormValues
} from '../../../components/ProjectFormFields';
import { useUpdateProject, useDeleteProject } from '../../../hooks/useProjects';
import { getErrorMessage } from '../../../lib/http';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';

type Props = {
  project: ProjectDetailData;
  workspaceId: string;
  teams: WorkspaceTeam[];
  onSaved: () => void;
  onClose: () => void;
  onDelete: () => void;
};

const toFormValues = (project: ProjectDetailData): ProjectFormValues => ({
  name: project.name,
  description: project.description,
  owner: project.owner?.id ?? '',
  status: project.status,
  color: project.color ?? null,
  startDate: project.start_date ?? '',
  targetDate: project.target_date ?? ''
});

export const ProjectSettingsForm = ({
  project,
  workspaceId,
  teams,
  onSaved,
  onClose,
  onDelete
}: Props) => {
  const [values, setValues] = useState(() => toFormValues(project));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateProject = useUpdateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);

  useEffect(() => {
    setValues(toFormValues(project));
    setError('');
  }, [project]);

  const handleSave = () => {
    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    updateProject.mutate(
      { projectId: project.public_id, data: toProjectRequestBody(values) },
      {
        onSuccess: () => onSaved(),
        onError: err => setError(getErrorMessage(err))
      }
    );
  };

  const doDelete = () => {
    setConfirmDelete(false);
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        onDelete();
        onSaved();
      },
      onError: err => setError(getErrorMessage(err))
    });
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Edit project"
      buttons={[
        {
          label: 'Delete project',
          type: 'danger',
          onClick: () => setConfirmDelete(true)
        },
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: updateProject.isPending ? 'Saving...' : 'Save',
          type: 'default',
          disabled: updateProject.isPending,
          onClick: handleSave
        }
      ]}
    >
      <ProjectFormFields
        values={values}
        onChange={setValues}
        onSubmit={handleSave}
        error={error}
        owners={teams}
        allowNoOwner
      />

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete project?"
        message={
          <>
            The project <b>{project.name}</b> and all its diagrams will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete project"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
};
