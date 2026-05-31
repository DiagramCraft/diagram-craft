import { useState, useRef, useEffect } from 'react';
import { Dialog } from '../components/Dialog';
import { TemplateSelector } from '../components/TemplateSelector';
import { ApiError } from '../api';
import type { FileEntry, ProjectFile } from '../api';
import { useCreateDiagramFile, useProjectTemplates, useCreateDiagramFromTemplate } from '../hooks/useProjectFiles';
import styles from './AddWorkspaceDialog.module.css';

type AddDiagramDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: FileEntry) => void;
  workspaceId: string;
  projectId: string;
  folder?: string | null;
};

export const AddDiagramDialog = ({ open, onClose, onCreated, workspaceId, projectId, folder }: AddDiagramDialogProps) => {
  const [stage, setStage] = useState<'template' | 'name'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectFile | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  
  const { data: templates, isLoading: templatesLoading } = useProjectTemplates(workspaceId, projectId);
  const createDiagramMutation = useCreateDiagramFile(workspaceId, projectId);
  const createFromTemplateMutation = useCreateDiagramFromTemplate(workspaceId, projectId);

  const hasTemplates = 
    (templates?.projectTemplates.length ?? 0) > 0 || 
    (templates?.workspaceTemplates.length ?? 0) > 0;

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      setSelectedTemplate(null);
      // If no templates, skip directly to name input
      setStage(hasTemplates ? 'template' : 'name');
      if (!hasTemplates) {
        setTimeout(() => nameRef.current?.focus(), 0);
      }
    }
  }, [open, hasTemplates]);

  const handleTemplateSelect = (template: ProjectFile | null) => {
    setSelectedTemplate(template);
    setStage('name');
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (trimmed.includes('/')) {
      setError('Name cannot contain /');
      return;
    }
    setError('');
    try {
      let file: FileEntry;
      if (selectedTemplate) {
        file = await createFromTemplateMutation.mutateAsync({ 
          name: trimmed, 
          templateFile: selectedTemplate, 
          folder 
        });
      } else {
        file = await createDiagramMutation.mutateAsync({ name: trimmed, folder });
      }
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

  const handleBack = () => {
    setStage('template');
    setError('');
  };

  if (templatesLoading) {
    return (
      <Dialog open={open} onClose={onClose} title="New diagram">
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading templates...</div>
      </Dialog>
    );
  }

  if (stage === 'template' && hasTemplates) {
    return (
      <Dialog open={open} onClose={onClose} title="Choose a template">
        <TemplateSelector
          workspaceTemplates={templates?.workspaceTemplates ?? []}
          projectTemplates={templates?.projectTemplates ?? []}
          onSelect={handleTemplateSelect}
          onCancel={onClose}
        />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="New diagram">
      <form className={styles.form} onSubmit={handleSubmit}>
        {selectedTemplate && (
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 8 }}>
            Using template: <strong>{selectedTemplate.name}</strong>
            {hasTemplates && (
              <button 
                type="button" 
                onClick={handleBack}
                style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}
              >
                Change
              </button>
            )}
          </div>
        )}
        <div className={styles.field}>
          <label>Diagram name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. System overview"
          />
        </div>
        {folder && (
          <div className="dim" style={{ fontSize: 12 }}>
            Will be created in <strong>{folder}</strong>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          {hasTemplates && (
            <button type="button" className={styles.btnCancel} onClick={handleBack}>
              Back
            </button>
          )}
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button 
            type="submit" 
            className={styles.btnSubmit} 
            disabled={createDiagramMutation.isPending || createFromTemplateMutation.isPending}
          >
            {(createDiagramMutation.isPending || createFromTemplateMutation.isPending) ? 'Creating...' : 'Create diagram'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
