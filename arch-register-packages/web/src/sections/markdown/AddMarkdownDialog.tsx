import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../../lib/http';
import styles from '../../dialogs/AddEntityDialog.module.css';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';

type AddMarkdownDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: ProjectFile) => void;
  onCreate: (name: string) => Promise<ProjectFile>;
  onOpenDraft?: (draft: {
    name: string;
    documentTypeId: string | null;
    templateId: string | null;
  }) => void;
  workspaceSlug: string;
  projectId?: string;
  isPending: boolean;
};

export const AddMarkdownDialog = ({
  open,
  onClose,
  onCreated,
  onCreate,
  onOpenDraft,
  workspaceSlug,
  projectId,
  isPending
}: AddMarkdownDialogProps) => {
  const [name, setName] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const { data: documentTypes = [], isLoading: documentTypesLoading } =
    useDocumentTypes(workspaceSlug);
  const { data: workspaceTemplates = [], isLoading: workspaceTemplatesLoading } =
    useDocumentTemplates(workspaceSlug, null);
  const { data: projectTemplates = [], isLoading: projectTemplatesLoading } = useDocumentTemplates(
    workspaceSlug,
    projectId ?? null
  );
  const documentTemplates = projectId
    ? [...workspaceTemplates, ...projectTemplates]
    : workspaceTemplates;
  const documentTemplatesLoading = workspaceTemplatesLoading || projectTemplatesLoading;

  const availableTypes = documentTypes.filter(type => !type.archived);
  const availableTemplates = documentTemplates.filter(template => !template.archived);

  useEffect(() => {
    if (open) {
      setName('');
      setDocumentTypeId('');
      setTemplateId('');
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    if (onOpenDraft) {
      onOpenDraft({
        name: trimmed,
        documentTypeId: documentTypeId || null,
        templateId: templateId || null
      });
      onClose();
      return;
    }
    try {
      const file = await onCreate(trimmed);
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

  const handleDocumentTypeChange = (nextTypeId: string) => {
    setDocumentTypeId(nextTypeId);
    if (
      templateId &&
      availableTemplates.find(template => template.id === templateId)?.document_type_id !==
        nextTypeId
    ) {
      setTemplateId('');
    }
  };

  const handleTemplateChange = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const template = availableTemplates.find(item => item.id === nextTemplateId);
    if (template) setDocumentTypeId(template.document_type_id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New markdown document"
      buttons={[
        { label: 'Cancel', onClick: onClose, type: 'cancel' },
        { label: 'Create', onClick: handleSubmit, type: 'default', disabled: isPending }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Name" error={error}>
          <TextInput
            ref={nameRef}
            value={name}
            onChange={v => setName(v ?? '')}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Architecture overview"
          />
        </FormElement>
        <FormElement label="Document type">
          <Select.Root
            value={documentTypeId || '__untyped__'}
            onChange={value =>
              handleDocumentTypeChange(value === '__untyped__' ? '' : (value ?? ''))
            }
            disabled={documentTypesLoading || isPending}
            style={{ width: '100%' }}
          >
            <Select.Item value="__untyped__">Untyped Markdown</Select.Item>
            {availableTypes.map(type => (
              <Select.Item key={type.id} value={type.id}>
                {type.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        <FormElement label="Template">
          <Select.Root
            value={templateId || '__blank__'}
            onChange={value => handleTemplateChange(value === '__blank__' ? '' : (value ?? ''))}
            disabled={documentTemplatesLoading || isPending}
            style={{ width: '100%' }}
          >
            <Select.Item value="__blank__">Blank document</Select.Item>
            {availableTemplates.map(template => (
              <Select.Item key={template.id} value={template.id}>
                {template.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      </div>
    </Dialog>
  );
};
