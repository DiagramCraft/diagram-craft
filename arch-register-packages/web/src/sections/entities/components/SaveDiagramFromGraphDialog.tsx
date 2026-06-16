import { useState, useEffect } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { FolderPickerTree } from '../../../components/FolderPickerTree';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useProjectFiles } from '../../../hooks/useProjectFiles';
import { useEntityContentNodes } from '../../../hooks/useProjects';
import {
  useWorkspaceContentNodes,
  useCreateWorkspaceDiagramWithContent,
  useCreateProjectDiagramWithContent
} from '../../../hooks/useProjectFiles';
import { useCreateEntityDiagramWithContent } from '../../../hooks/useProjects';
import { useEntities } from '../../../hooks/useEntities';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import type { ProjectFile } from '@arch-register/api-types/projectContract';

type DestinationType = 'workspace' | 'entity' | 'project';

type SaveDiagramFromGraphDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: ProjectFile) => void;
  workspaceId: string;
  diagramContent: SerializedDiagramDocument;
  defaultName: string;
  initialDestination?: { type: 'entity'; entityId: string; entityName?: string } | { type: 'workspace' };
};

export const SaveDiagramFromGraphDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  diagramContent,
  defaultName,
  initialDestination
}: SaveDiagramFromGraphDialogProps) => {
  const { projects, workspace } = useWorkspaceContext();

  const defaultDestType: DestinationType =
    initialDestination?.type === 'entity'
      ? 'entity'
      : initialDestination?.type === 'workspace'
        ? 'workspace'
        : 'workspace';

  const [destType, setDestType] = useState<DestinationType>(defaultDestType);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    initialDestination?.type === 'entity' ? initialDestination.entityId : ''
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return;
    setDestType(defaultDestType);
    setSelectedProjectId('');
    setSelectedEntityId(
      initialDestination?.type === 'entity' ? initialDestination.entityId : ''
    );
    setSelectedFolder(null);
    setName(defaultName);
    setError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if we're in a "fixed entity" mode (entity was passed in as initialDestination)
  const fixedEntityId =
    initialDestination?.type === 'entity' ? initialDestination.entityId : null;
  const fixedEntityName =
    initialDestination?.type === 'entity' ? initialDestination.entityName : null;

  // Fetch entities for the entity picker (only needed when destType is 'entity' and no fixed entity)
  const { data: entitiesData } = useEntities(workspaceId, {
    view: 'summary',
    limit: 200
  });
  const entities = entitiesData ?? [];

  // Effective entity id: fixed or selected
  const effectiveEntityId = fixedEntityId ?? selectedEntityId;
  // Effective project id
  const effectiveProjectId = selectedProjectId;

  // Fetch folders for the active destination
  const { data: workspaceContent } = useWorkspaceContentNodes(workspaceId, {
    enabled: destType === 'workspace'
  });
  const { data: projectContent } = useProjectFiles(workspaceId, effectiveProjectId);
  const { data: entityContent } = useEntityContentNodes(workspaceId, effectiveEntityId, {
    enabled: destType === 'entity' && !!effectiveEntityId
  });

  const activeFolders =
    destType === 'workspace'
      ? (workspaceContent?.folders ?? [])
      : destType === 'project'
        ? (projectContent?.folders ?? [])
        : (entityContent?.folders ?? []);

  // Mutations
  const createWorkspace = useCreateWorkspaceDiagramWithContent(workspaceId);
  const createProject = useCreateProjectDiagramWithContent(workspaceId, effectiveProjectId);
  const createEntity = useCreateEntityDiagramWithContent(workspaceId, effectiveEntityId);

  const isPending =
    createWorkspace.isPending || createProject.isPending || createEntity.isPending;

  const handleSubmit = async () => {
    const finalName = name.trim() || defaultName;
    if (finalName.includes('/')) {
      setError('Name cannot contain /');
      return;
    }
    if (destType === 'project' && !effectiveProjectId) {
      setError('Please select a project');
      return;
    }
    if (destType === 'entity' && !effectiveEntityId) {
      setError('Please select an entity');
      return;
    }
    setError('');

    const content = { ...(diagramContent as unknown as Record<string, unknown>), name: finalName };

    try {
      let file: ProjectFile;
      if (destType === 'workspace') {
        file = await createWorkspace.mutateAsync({ name: finalName, folder: selectedFolder, content });
      } else if (destType === 'project') {
        file = await createProject.mutateAsync({ name: finalName, folder: selectedFolder, content });
      } else {
        file = await createEntity.mutateAsync({ name: finalName, folder: selectedFolder, content });
      }
      onCreated(file);
      onClose();
    } catch {
      setError('Something went wrong');
    }
  };

  const showEntityPicker = destType === 'entity' && !fixedEntityId;
  const showProjectPicker = destType === 'project';
  const folderPickerEnabled =
    destType === 'workspace' ||
    (destType === 'project' && !!effectiveProjectId) ||
    (destType === 'entity' && !!effectiveEntityId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sup="Create diagram"
      title="Choose destination"
      width={480}
      footerLeft={
        <KbdHints hints={[['Esc', 'cancel'], ['⌘↵', 'create']]} />
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isPending ? 'Creating...' : 'Create diagram',
          type: 'default',
          disabled: isPending,
          onClick: () => { void handleSubmit(); }
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormElement label="Save to">
          <Select.Root
            value={destType}
            onChange={v => {
              if (v) {
                setDestType(v as DestinationType);
                setSelectedFolder(null);
              }
            }}
          >
            <Select.Item value="workspace">
              Workspace{workspace?.name ? ` (${workspace.name})` : ''}
            </Select.Item>
            {!fixedEntityId && (
              <Select.Item value="entity">Entity</Select.Item>
            )}
            {fixedEntityId && (
              <Select.Item value="entity">
                Entity{fixedEntityName ? ` (${fixedEntityName})` : ''}
              </Select.Item>
            )}
            <Select.Item value="project">Project</Select.Item>
          </Select.Root>
        </FormElement>

        {showEntityPicker && (
          <FormElement label="Entity">
            <Select.Root
              value={selectedEntityId}
              onChange={v => {
                setSelectedEntityId(v ?? '');
                setSelectedFolder(null);
              }}
            >
              <Select.Item value="">— select entity —</Select.Item>
              {entities.map(e => (
                <Select.Item key={e._uid} value={e._uid}>
                  {e._name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}

        {showProjectPicker && (
          <FormElement label="Project">
            <Select.Root
              value={selectedProjectId}
              onChange={v => {
                setSelectedProjectId(v ?? '');
                setSelectedFolder(null);
              }}
            >
              <Select.Item value="">— select project —</Select.Item>
              {projects.map(p => (
                <Select.Item key={p.id} value={p.id}>
                  {p.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}

        {folderPickerEnabled && (
          <FormElement label="Folder">
            <FolderPickerTree
              folders={activeFolders}
              selected={selectedFolder}
              onSelect={setSelectedFolder}
            />
          </FormElement>
        )}

        <FormElement
          label="Diagram name"
          hint={selectedFolder ? `Will be created in ${selectedFolder}` : undefined}
          error={error}
        >
          <TextInput
            placeholder={defaultName}
            value={name}
            onChange={v => setName(v ?? '')}
            style={{ width: '100%' }}
          />
        </FormElement>
      </div>
    </Dialog>
  );
};
