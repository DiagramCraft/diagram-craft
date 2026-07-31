import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { ApiError } from '../../../lib/http';
import {
  useArchiveDocumentTemplate,
  useCreateDocumentTemplate,
  useDocumentTemplates,
  useDocumentTypes,
  useUpdateDocumentTemplate
} from '../../../hooks/useDocuments';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import styles from './ProjectMarkdownTemplatesDialog.module.css';

type Props = {
  open: boolean;
  project: ProjectDetailData;
  workspaceId: string;
  onClose: () => void;
};

export const ProjectMarkdownTemplatesDialog = ({ open, project, workspaceId, onClose }: Props) => {
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('# {{title}}\n');
  const [templateDefaults, setTemplateDefaults] = useState('{}');
  const [templateTypeId, setTemplateTypeId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState('');

  const { data: projectTemplates = [] } = useDocumentTemplates(workspaceId, project.id, true);
  const { data: documentTypes = [] } = useDocumentTypes(workspaceId, true);
  const createTemplate = useCreateDocumentTemplate(workspaceId);
  const updateTemplate = useUpdateDocumentTemplate(workspaceId);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceId);
  const selectedTemplateType = documentTypes.find(type => type.id === templateTypeId);

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateBody('# {{title}}\n');
    setTemplateDefaults('{}');
    setTemplateTypeId('');
    setEditingTemplateId(null);
    setTemplateError('');
  };

  const handleClose = () => {
    resetTemplateForm();
    onClose();
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !selectedTemplateType) return;
    setTemplateError('');
    try {
      const parsedDefaults: unknown = JSON.parse(templateDefaults);
      if (
        parsedDefaults === null ||
        typeof parsedDefaults !== 'object' ||
        Array.isArray(parsedDefaults)
      ) {
        throw new Error('Metadata defaults must be a JSON object');
      }
      const body = {
        name: templateName.trim(),
        body: templateBody,
        document_type_id: selectedTemplateType.id,
        metadata_defaults: parsedDefaults as DocumentMetadata,
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
      width={620}
      buttons={[{ label: 'Close', type: 'cancel', onClick: handleClose }]}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Project Markdown templates</label>
        <div className={styles.templateList}>
          {projectTemplates.map(template => (
            <div key={template.id} className={styles.templateRow}>
              <span className={styles.templateName}>
                {template.name} ·{' '}
                {documentTypes.find(type => type.id === template.document_type_id)?.name ??
                  'Unknown type'}
                {template.archived ? ' · archived' : ''}
              </span>
              <Button
                onClick={() => {
                  setEditingTemplateId(template.id);
                  setTemplateName(template.name);
                  setTemplateBody(template.body);
                  setTemplateTypeId(template.document_type_id);
                  setTemplateDefaults(JSON.stringify(template.metadata_defaults, null, 2));
                }}
              >
                Edit
              </Button>
              <Button
                onClick={() =>
                  void archiveTemplate.mutateAsync({
                    id: template.id,
                    archived: !template.archived
                  })
                }
              >
                {template.archived ? 'Unarchive' : 'Archive'}
              </Button>
            </div>
          ))}
          <input
            className={styles.formInput}
            value={templateName}
            onChange={event => setTemplateName(event.target.value)}
            placeholder="Template name"
          />
          <select
            className={styles.formInput}
            value={templateTypeId}
            onChange={event => setTemplateTypeId(event.target.value)}
          >
            <option value="">Select a document type</option>
            {documentTypes
              .filter(type => !type.archived || type.id === templateTypeId)
              .map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.archived ? ' (archived)' : ''}
                </option>
              ))}
          </select>
          <textarea
            className={`${styles.formInput} ${styles.formTextarea}`}
            rows={5}
            value={templateBody}
            onChange={event => setTemplateBody(event.target.value)}
          />
          <textarea
            className={`${styles.formInput} ${styles.formTextarea}`}
            rows={4}
            value={templateDefaults}
            onChange={event => setTemplateDefaults(event.target.value)}
            placeholder="Metadata defaults (JSON)"
          />
          {templateError && <div className={styles.error}>{templateError}</div>}
          <div className={styles.formActions}>
            {editingTemplateId && <Button onClick={resetTemplateForm}>Cancel</Button>}
            <Button
              variant="primary"
              onClick={() => void saveTemplate()}
              disabled={
                !templateName.trim() ||
                !selectedTemplateType ||
                createTemplate.isPending ||
                updateTemplate.isPending
              }
            >
              {editingTemplateId ? 'Save template' : 'Add template'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
