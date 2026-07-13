import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../lib/http';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { usePermissions } from '../auth/PermissionContext';
import { ColorPicker } from '../components/ColorPicker';
import { useCreateProject } from '../hooks/useProjects';
import styles from './AddEntityDialog.module.css';
import { Project } from '@arch-register/api-types/projectContract';

const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' }
] as const;

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
  const { canCreateProject } = usePermissions();
  const createProjectMutation = useCreateProject(workspaceId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'complete' | 'cancelled'>('active');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const creatableTeams = useMemo(
    () => teams.filter(team => canCreateProject(workspaceId, team.id)),
    [canCreateProject, teams, workspaceId]
  );
  const canCreateWithoutOwner = canCreateProject(workspaceId, null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setOwner(canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? ''));
      setStatus('active');
      setColor(null);
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [canCreateWithoutOwner, creatableTeams, open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    try {
      const project = await createProjectMutation.mutateAsync({
        name: trimmed,
        description: description.trim(),
        owner: owner || null,
        status,
        color
      });
      onCreated(project);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
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
      <form
        className={styles.form}
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <button type="submit" hidden />
        <FormElement label="Name">
          <TextInput
            ref={nameRef}
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder="e.g. Checkout Modernization"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement label="Description">
          <TextArea
            value={description}
            onChange={value => setDescription(value ?? '')}
            placeholder="Optional — what is this project about?"
            rows={3}
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement label="Status">
          <Select.Root
            value={status}
            onChange={value =>
              setStatus((value as 'draft' | 'active' | 'complete' | 'cancelled' | undefined) ?? 'active')
            }
            style={{ width: '100%' }}
          >
            {PROJECT_STATUSES.map(option => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        <FormElement label="Owner">
          <Select.Root
            value={owner || undefined}
            onChange={value => setOwner(value ?? '')}
            placeholder={canCreateWithoutOwner ? 'No owner' : 'Select owner'}
            style={{ width: '100%' }}
          >
            {creatableTeams.map(team => (
              <Select.Item key={team.id} value={team.id}>
                {team.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        <FormElement label="Color">
          <ColorPicker value={color} onChange={setColor} size="small" />
        </FormElement>
        {error && <div className={styles.error}>{error}</div>}
      </form>
    </Dialog>
  );
};
