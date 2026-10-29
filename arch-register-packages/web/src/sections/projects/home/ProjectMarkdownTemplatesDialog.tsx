import { useState } from 'react';
import { TbPlus } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Banner } from '../../../components/Banner';
import { ApiError } from '../../../lib/http';
import {
  useArchiveDocumentTemplate,
  useCreateDocumentTemplate,
  useDocumentTemplates,
  useDocumentTypes,
  useUpdateDocumentTemplate
} from '../../../hooks/useDocuments';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import {
  pruneDefaultsForType,
  TemplateMetadataDefaultsForm
} from '../../workspace-settings/TemplateMetadataDefaultsForm';
import styles from './ProjectMarkdownTemplatesDialog.module.css';

const UNTYPED = '__untyped__';

type Props = {
  open: boolean;
  project: ProjectDetailData;
  workspaceId: string;
  onClose: () => void;
};

export const ProjectMarkdownTemplatesDialog = ({ open, project, workspaceId, onClose }: Props) => {
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('# {{title}}\n');
  const [templateDefaults, setTemplateDefaults] = useState<DocumentMetadata>({});
  const [templateTypeId, setTemplateTypeId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  // The editor stays hidden until a template is selected or "New template" is clicked.
  const [isCreating, setIsCreating] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const { data: projectTemplates = [] } = useDocumentTemplates(workspaceId, project.id, true);
  const { data: documentTypes = [] } = useDocumentTypes(workspaceId, true);
  const createTemplate = useCreateDocumentTemplate(workspaceId);
  const updateTemplate = useUpdateDocumentTemplate(workspaceId);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceId);
  const isUntyped = templateTypeId === UNTYPED;
  const selectedTemplateType = documentTypes.find(type => type.id === templateTypeId);

  const showEditor = isCreating || editingTemplateId != null;
  const editingTemplate = projectTemplates.find(template => template.id === editingTemplateId);

  const selectTemplate = (template: (typeof projectTemplates)[number]) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateBody(template.body);
    setTemplateTypeId(template.document_type_id ?? UNTYPED);
    setTemplateDefaults(template.metadata_defaults);
    setTemplateError('');
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateBody('# {{title}}\n');
    setTemplateDefaults({});
    setTemplateTypeId('');
    setEditingTemplateId(null);
    setIsCreating(false);
    setTemplateError('');
  };

  const startNewTemplate = () => {
    resetTemplateForm();
    setIsCreating(true);
  };

  const handleClose = () => {
    resetTemplateForm();
    onClose();
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || (!selectedTemplateType && !isUntyped)) return;
    setTemplateError('');
    try {
      const body = {
        name: templateName.trim(),
        body: templateBody,
        document_type_id: selectedTemplateType?.id ?? null,
        metadata_defaults: isUntyped ? {} : templateDefaults,
        project_id: project.id
      };
      if (editingTemplateId) await updateTemplate.mutateAsync({ id: editingTemplateId, body });
      else await createTemplate.mutateAsync(body);
      resetTemplateForm();
    } catch (cause) {
      setTemplateError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'Unable to save project template'
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Edit Markdown Templates"
      width={820}
      buttons={[{ label: 'Close', type: 'cancel', onClick: handleClose }]}
    >
      <div className={styles.layout}>
        <div className={styles.listPane}>
          <div className={styles.list}>
            {projectTemplates.length === 0 ? (
              <div className={styles.emptyList}>No project templates yet.</div>
            ) : (
              projectTemplates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`${styles.listRow} ${editingTemplateId === template.id ? styles.listRowActive : ''}`}
                  onClick={() => selectTemplate(template)}
                >
                  <span
                    className={`${styles.listRowName} ${template.archived ? styles.listRowNameArchived : ''}`}
                  >
                    {template.name}
                  </span>
                  <span className={styles.listRowSub}>
                    {template.document_type_id === null
                      ? 'Untyped Markdown'
                      : (documentTypes.find(type => type.id === template.document_type_id)?.name ??
                        'Unknown type')}
                    {template.archived ? ' · archived' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className={styles.listFooter}>
            <button type="button" className={styles.newButton} onClick={startNewTemplate}>
              <TbPlus size={13} />
              New template
            </button>
          </div>
        </div>
        <div className={styles.editorPane}>
          {showEditor ? (
            <>
              <div className={styles.editorFields}>
                <FormElement label="Template name" required>
                  <TextInput
                    value={templateName}
                    onChange={value => setTemplateName(value ?? '')}
                    placeholder="e.g. Architecture decision record"
                  />
                </FormElement>
                <FormElement label="Document type" required>
                  <Select.Root
                    value={templateTypeId || undefined}
                    onChange={value => {
                      setTemplateTypeId(value ?? '');
                      setTemplateDefaults(current =>
                        pruneDefaultsForType(
                          current,
                          documentTypes.find(type => type.id === value)
                        )
                      );
                    }}
                    placeholder="Select a document type"
                  >
                    <Select.Item value={UNTYPED}>Untyped Markdown</Select.Item>
                    {documentTypes
                      .filter(type => !type.archived || type.id === templateTypeId)
                      .map(type => (
                        <Select.Item key={type.id} value={type.id}>
                          {type.name}
                          {type.archived ? ' (archived)' : ''}
                        </Select.Item>
                      ))}
                  </Select.Root>
                </FormElement>
                <FormElement label="Body" required>
                  <TextArea
                    rows={5}
                    value={templateBody}
                    onChange={value => setTemplateBody(value ?? '')}
                  />
                </FormElement>
                <TemplateMetadataDefaultsForm
                  documentTypeId={templateTypeId}
                  selectedType={selectedTemplateType}
                  defaults={templateDefaults}
                  onChange={setTemplateDefaults}
                />
                {templateError && <Banner variant="error">{templateError}</Banner>}
              </div>
              <div className={styles.editorActions}>
                {editingTemplate && (
                  <Button
                    onClick={() =>
                      void archiveTemplate.mutateAsync({
                        id: editingTemplate.id,
                        archived: !editingTemplate.archived
                      })
                    }
                  >
                    {editingTemplate.archived ? 'Unarchive' : 'Archive'}
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => void saveTemplate()}
                  disabled={
                    !templateName.trim() ||
                    (!selectedTemplateType && !isUntyped) ||
                    createTemplate.isPending ||
                    updateTemplate.isPending
                  }
                >
                  {editingTemplateId ? 'Save template' : 'Add template'}
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.editorEmpty}>
              Select a template to edit it, or click New template to add one.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
