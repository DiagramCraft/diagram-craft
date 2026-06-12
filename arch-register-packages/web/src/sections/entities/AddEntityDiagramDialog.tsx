import { useState, useRef, useEffect } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError, emptyDiagram } from '../../lib/api';
import { useCreateEntityFile } from '../../hooks/useProjects';
import type { ProjectFile } from '@arch-register/api-types/projectContract';

type AddEntityDiagramDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: ProjectFile) => void;
  workspaceId: string;
  entityId: string;
  folder?: string | null;
};

export const AddEntityDiagramDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  entityId,
  folder
}: AddEntityDiagramDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const createFileMutation = useCreateEntityFile(workspaceId, entityId);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setName('');
    setError('');
    setTimeout(() => nameRef.current?.focus(), 30);
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleSubmit = async () => {
    const trimmed = name.trim();
    const finalName = trimmed || 'Untitled diagram';

    if (finalName.includes('/')) {
      setError('Name cannot contain /');
      return;
    }
    setError('');

    try {
      const path = folder ? `${folder}/${finalName}.json` : `${finalName}.json`;
      
      // Create a blank diagram document using the same structure as project diagrams
      const blankDiagram = emptyDiagram(finalName);

      const file = await createFileMutation.mutateAsync({
        path,
        body: blankDiagram
      });
      
      onCreated(file);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    }
  };

  const isPending = createFileMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New diagram"
      sub={folder ? `Will be created in ${folder}` : 'Will be created in root'}
      width={480}
      footerLeft={
        <KbdHints
          hints={[
            ['Esc', 'cancel'],
            ['⌘↵', 'create']
          ]}
        />
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isPending ? 'Creating...' : 'Create diagram',
          type: 'default',
          disabled: isPending,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <FormElement label="Diagram name" error={error}>
        <TextInput
          ref={nameRef}
          placeholder="Untitled diagram"
          value={name}
          onChange={value => setName(value ?? '')}
          style={{ width: '100%' }}
        />
      </FormElement>
    </Dialog>
  );
};
