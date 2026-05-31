import { useState, useRef, useEffect } from 'react';
import { TbPlus, TbX, TbCheck } from 'react-icons/tb';
import { ApiError } from '../api';
import type { FileEntry, ProjectFile } from '../api';
import { useCreateDiagramFile, useProjectTemplates, useCreateDiagramFromTemplate } from '../hooks/useProjectFiles';
import styles from './AddDiagramDialog.module.css';

type AddDiagramDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: FileEntry) => void;
  workspaceId: string;
  projectId: string;
  projectName?: string;
  folder?: string | null;
};

// Dummy SVG preview (matches the one used in project detail grid cards)
const DummyPreview = () => (
  <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet">
    <rect x="14" y="18" width="36" height="20" rx="2" fill="var(--bg-3, #2a2a2e)" stroke="var(--border-strong, #444)" strokeWidth="1" />
    <rect x="62" y="8" width="36" height="20" rx="2" fill="var(--bg-3, #2a2a2e)" stroke="var(--border-strong, #444)" strokeWidth="1" />
    <rect x="62" y="52" width="36" height="20" rx="2" fill="var(--bg-3, #2a2a2e)" stroke="var(--border-strong, #444)" strokeWidth="1" />
    <rect x="110" y="30" width="36" height="20" rx="2" fill="color-mix(in oklch, var(--accent) 28%, var(--bg-3, #2a2a2e))" stroke="var(--accent)" strokeWidth="1" />
    <path d="M50 28 L62 18 M50 28 L62 62 M98 18 L110 40 M98 62 L110 40"
      stroke="var(--fg-3, #666)" fill="none" strokeWidth="1" />
  </svg>
);

const BlankPreview = () => (
  <svg viewBox="0 0 160 90">
    <rect x="20" y="14" width="120" height="62" rx="4" fill="none"
      stroke="var(--border, #444)" strokeWidth="1.5" strokeDasharray="5 5" />
    <path d="M80 36v18M71 45h18" stroke="var(--fg-3, #666)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AddDiagramDialog = ({ open, onClose, onCreated, workspaceId, projectId, projectName, folder }: AddDiagramDialogProps) => {
  const [selected, setSelected] = useState<ProjectFile | 'blank'>('blank');
  const [name, setName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const { data: templates, isLoading: templatesLoading } = useProjectTemplates(workspaceId, projectId);
  const createDiagramMutation = useCreateDiagramFile(workspaceId, projectId);
  const createFromTemplateMutation = useCreateDiagramFromTemplate(workspaceId, projectId);

  const allTemplates = [
    ...(templates?.projectTemplates ?? []),
    ...(templates?.workspaceTemplates ?? []),
  ];

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSelected('blank');
    setName('');
    setNameDirty(false);
    setError('');
    setTimeout(() => nameRef.current?.focus(), 30);
  }, [open]);

  // Default name follows template selection unless user has edited
  useEffect(() => {
    if (nameDirty) return;
    if (selected === 'blank') {
      setName('');
    } else {
      setName(selected.name);
    }
  }, [selected, nameDirty]);

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

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    const fallbackName = selected === 'blank' ? 'Untitled diagram' : selected.name;
    const finalName = trimmed || fallbackName;

    if (finalName.includes('/')) {
      setError('Name cannot contain /');
      return;
    }
    setError('');

    try {
      let file: FileEntry;
      if (selected !== 'blank') {
        file = await createFromTemplateMutation.mutateAsync({
          name: finalName,
          templateFile: selected,
          folder,
        });
      } else {
        file = await createDiagramMutation.mutateAsync({ name: finalName, folder });
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

  const isPending = createDiagramMutation.isPending || createFromTemplateMutation.isPending;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="ndg-title">
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.eyebrow}>New diagram</div>
            <h2 id="ndg-title" className={styles.title}>Choose a starting point</h2>
            {projectName && (
              <div className={styles.subtitle}>
                Adds to <b>{projectName}</b>. Pick a template or start from a blank canvas.
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <TbX size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Blank canvas option */}
          <button
            type="button"
            className={`${styles.blankOption} ${selected === 'blank' ? styles.isActive : ''}`}
            onClick={() => setSelected('blank')}
          >
            <span className={styles.blankThumb}><BlankPreview /></span>
            <span className={styles.blankText}>
              <span className={styles.blankName}>Blank canvas</span>
              <span className={styles.blankDesc}>No template — start from an empty diagram.</span>
            </span>
            <span className={styles.radio}>
              {selected === 'blank' && <TbCheck size={11} />}
            </span>
          </button>

          {/* Template section */}
          {!templatesLoading && allTemplates.length > 0 && (
            <>
              <div className={styles.divider}>
                <span>Start from a template</span>
              </div>

              <div className={styles.grid}>
                {allTemplates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.card} ${selected !== 'blank' && selected.id === t.id ? styles.isActive : ''}`}
                    onClick={() => setSelected(t)}
                    title={t.name}
                  >
                    <span className={styles.cardThumb}>
                      <DummyPreview />
                      {selected !== 'blank' && selected.id === t.id && (
                        <span className={styles.cardCheck}><TbCheck size={10} /></span>
                      )}
                    </span>
                    <span className={styles.cardName}>{t.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Name field */}
          <div className={styles.nameField}>
            <label className={styles.nameLabel}>Diagram name</label>
            <input
              ref={nameRef}
              className={styles.nameInput}
              placeholder={selected === 'blank' ? 'Untitled diagram' : selected.name}
              value={name}
              onChange={e => { setName(e.target.value); setNameDirty(true); }}
            />
            {folder && (
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>
                Will be created in <b>{folder}</b>
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span><span className={styles.kbd}>Esc</span> to cancel</span>
            <span><span className={styles.kbd}>⌘</span><span className={styles.kbd}>⏎</span> to create</span>
          </div>
          <div className={styles.footerRight}>
            <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleSubmit} disabled={isPending}>
              <TbPlus size={11} /> {isPending ? 'Creating...' : 'Create diagram'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
