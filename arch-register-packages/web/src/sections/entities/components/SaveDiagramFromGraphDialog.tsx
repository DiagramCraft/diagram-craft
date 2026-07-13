import { useState, useEffect } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { FolderPickerTree } from '../../../components/FolderPickerTree';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useContentScopeOperations,
  useContentTree,
  type ContentScope
} from '../../../hooks/useContentScope';
import { useEntities } from '../../../hooks/useEntities';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { ApiError } from '../../../lib/http';

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
  }, [open, defaultDestType, initialDestination, defaultName]);

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

  const scope: ContentScope =
    destType === 'workspace'
      ? { kind: 'workspace', workspaceId }
      : destType === 'project'
        ? { kind: 'project', workspaceId, projectId: effectiveProjectId }
        : { kind: 'entity', workspaceId, entityId: effectiveEntityId };
  const { data: contentTree } = useContentTree(scope);
  const contentOperations = useContentScopeOperations(scope);
  const activeFolders = contentTree?.folders ?? [];
  const isPending = contentOperations.createDiagram.isPending;

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
      const file = await contentOperations.createDiagram.mutateAsync({
        name: finalName,
        folder: selectedFolder,
        content
      });
      onCreated(file);
      onClose();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'Something went wrong');
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
