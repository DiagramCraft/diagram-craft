import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbTrash } from 'react-icons/tb';
import { ColorPicker } from '../../../components/ColorPicker';
import { useUpdateProject, useDeleteProject } from '../../../hooks/useProjects';
import {
  useArchiveDocumentTemplate,
  useCreateDocumentTemplate,
  useDocumentTemplates,
  useDocumentTypes,
  useUpdateDocumentTemplate
} from '../../../hooks/useDocuments';
import { ApiError } from '../../../lib/http';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from './ProjectSettingsForm.module.css';

const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' }
] as const;

type Props = {
  project: ProjectDetailData;
  workspaceId: string;
  teams: WorkspaceTeam[];
  onSaved: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export const ProjectSettingsForm = ({
  project,
  workspaceId,
  teams,
  onSaved,
  onClose,
  onDelete
}: Props) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [owner, setOwner] = useState(project.owner?.id ?? '');
  const [status, setStatus] = useState(project.status);
  const [color, setColor] = useState<string | null>(project.color ?? null);
  const [targetDate, setTargetDate] = useState(project.target_date ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('# {{title}}\n');
  const [templateDefaults, setTemplateDefaults] = useState('{}');
  const [templateTypeId, setTemplateTypeId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState('');

  const updateProject = useUpdateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);
  const { data: projectTemplates = [] } = useDocumentTemplates(workspaceId, project.id, true);
  const { data: documentTypes = [] } = useDocumentTypes(workspaceId, true);
  const createTemplate = useCreateDocumentTemplate(workspaceId);
  const updateTemplate = useUpdateDocumentTemplate(workspaceId);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceId);
  const selectedTemplateType = documentTypes.find(type => type.id === templateTypeId);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setOwner(project.owner?.id ?? '');
    setStatus(project.status);
    setColor(project.color ?? null);
    setTargetDate(project.target_date ?? '');
    setError('');
  }, [project]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError('');
    updateProject.mutate(
      {
        projectId: project.public_id,
        data: {
          name: trimmed,
          description: description.trim(),
          owner: owner ?? null,
          status,
          color,
          target_date: targetDate ?? null
        }
      },
      {
        onSuccess: () => onSaved(),
        onError: err => {
          setError(err instanceof ApiError ? err.message : 'Something went wrong');
        }
      }
    );
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        onDelete();
        onSaved();
      },
      onError: err => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
      }
    });
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateBody('# {{title}}\n');
    setTemplateDefaults('{}');
    setTemplateTypeId('');
    setEditingTemplateId(null);
    setTemplateError('');
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
    <Dialog open={true} onClose={onClose} title="Edit project">
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Name</label>
        <input className={styles.formInput} value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Description (optional)</label>
        <textarea
          className={`${styles.formInput} ${styles.formTextarea}`}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Status</label>
        <select
          className={styles.formInput}
          value={status}
          onChange={e => setStatus(e.target.value as 'draft' | 'active' | 'complete' | 'cancelled')}
        >
          {PROJECT_STATUSES.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Owner (optional)</label>
        <select className={styles.formInput} value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="">No owner</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Color (optional)</label>
        <ColorPicker value={color} onChange={setColor} size="small" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Target date (optional)</label>
        <input
          className={styles.formInput}
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Project Markdown templates</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {projectTemplates.map(template => (
            <div
              key={template.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
            >
              <span style={{ flex: 1 }}>
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
          {templateError && (
            <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{templateError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
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
      {error && <div style={{ fontSize: 12, color: 'var(--error-fg)' }}>{error}</div>}
      <div className={styles.formActions}>
        <Button variant="danger" icon={<TbTrash size={12} />} onClick={handleDelete}>
          Delete project
        </Button>
        <div className={styles.formSpacer} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={updateProject.isPending}>
          {updateProject.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

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
