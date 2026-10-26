import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { getErrorMessage } from '../lib/http';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useWorkspaceAuthorization } from '../auth/WorkspaceAuthorizationContext';
import {
  EMPTY_PROJECT_FORM_VALUES,
  ProjectFormFields,
  toProjectRequestBody,
  type ProjectFormValues
} from '../components/ProjectFormFields';
import { useCreateProject } from '../hooks/useProjects';
import { Project } from '@arch-register/api-types/projectCrudContract';
import { useAutoFocus } from '../hooks/useAutoFocus';

type AddProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  workspaceId: string;
  teams: WorkspaceTeam[];
};

export const AddProjectDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  teams
}: AddProjectDialogProps) => {
  const { canCreateProject } = useWorkspaceAuthorization(workspaceId);
  const createProjectMutation = useCreateProject(workspaceId);
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM_VALUES);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoFocus(nameRef, { enabled: open });
  const creatableTeams = useMemo(
    () => teams.filter(team => canCreateProject(team.id)),
    [canCreateProject, teams]
  );
  const canCreateWithoutOwner = canCreateProject(null);

  useEffect(() => {
    if (open) {
      setValues({
        ...EMPTY_PROJECT_FORM_VALUES,
        owner: canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? '')
      });
      setError('');
    }
  }, [canCreateWithoutOwner, creatableTeams, open]);

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    try {
      const project = await createProjectMutation.mutateAsync(toProjectRequestBody(values));
      onCreated(project);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: createProjectMutation.isPending ? 'Creating...' : 'Create project',
          type: 'default',
          disabled: createProjectMutation.isPending,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <ProjectFormFields
        values={values}
        onChange={setValues}
        onSubmit={() => void handleSubmit()}
        error={error}
        owners={creatableTeams}
        allowNoOwner={canCreateWithoutOwner}
        nameRef={nameRef}
      />
    </Dialog>
  );
};
