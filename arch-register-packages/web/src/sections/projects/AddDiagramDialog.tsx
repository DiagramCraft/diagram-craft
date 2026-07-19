import { useState, useRef, useEffect, useMemo } from 'react';
import { TbCheck } from 'react-icons/tb';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ApiError } from '../../lib/http';
import { useContentScopeOperations, type ContentScope } from '../../hooks/useContentScope';
import { useProjectTemplates, useWorkspaceOnlyTemplates } from '../../hooks/useTemplates';
import styles from './AddDiagramDialog.module.css';
import { useAutoFocus } from '../../hooks/useAutoFocus';
import { ProjectFile } from '@arch-register/api-types/projectContract';

type AddDiagramDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (file: ProjectFile) => void;
  workspaceId: string;
  folder?: string | null;
} & (
  | { context: 'project'; projectId: string; projectName?: string }
  | { context: 'entity'; entityId: string }
  | { context: 'workspace' }
);

// Dummy SVG preview (matches the one used in project detail grid cards)
const DummyPreview = () => (
  <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet">
    <rect
      x="14"
      y="18"
      width="36"
      height="20"
      rx="2"
      fill="var(--cmp-bg)"
      stroke="var(--base-fg-more-dim)"
      strokeWidth="1"
    />
    <rect
      x="62"
      y="8"
      width="36"
      height="20"
      rx="2"
      fill="var(--cmp-bg)"
      stroke="var(--base-fg-more-dim)"
      strokeWidth="1"
    />
    <rect
      x="62"
      y="52"
      width="36"
      height="20"
      rx="2"
      fill="var(--cmp-bg)"
      stroke="var(--base-fg-more-dim)"
      strokeWidth="1"
    />
    <rect
      x="110"
      y="30"
      width="36"
      height="20"
      rx="2"
      fill="color-mix(in oklch, var(--accent-fg) 28%, var(--cmp-bg))"
      stroke="var(--accent-fg)"
      strokeWidth="1"
    />
    <path
      d="M50 28 L62 18 M50 28 L62 62 M98 18 L110 40 M98 62 L110 40"
      stroke="var(--cmp-fg-disabled)"
      fill="none"
      strokeWidth="1"
    />
  </svg>
);

const BlankPreview = () => (
  <svg viewBox="0 0 160 90">
    <rect
      x="20"
      y="14"
      width="120"
      height="62"
      rx="4"
      fill="none"
      stroke="var(--cmp-border)"
      strokeWidth="1.5"
      strokeDasharray="5 5"
    />
    <path
      d="M80 36v18M71 45h18"
      stroke="var(--cmp-fg-disabled)"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const AddDiagramDialog = (props: AddDiagramDialogProps) => {
  const { open, onClose, onCreated, workspaceId, folder } = props;
  const projectId = props.context === 'project' ? props.projectId : '';
  const entityId = props.context === 'entity' ? props.entityId : '';

  const [selected, setSelected] = useState<ProjectFile | 'blank'>('blank');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoFocus(nameRef, { enabled: open, delay: 30 });

  // Project context: project + workspace templates
  const { data: projectTemplateData, isLoading: projectTemplatesLoading } = useProjectTemplates(
    workspaceId,
    projectId
  );
  // Entity context: workspace-only templates
  const { data: workspaceOnlyTemplates, isLoading: workspaceTemplatesLoading } =
    useWorkspaceOnlyTemplates(workspaceId);

  const scope: ContentScope = useMemo(
    () =>
      props.context === 'project'
        ? { kind: 'project', workspaceId, projectId }
        : props.context === 'entity'
          ? { kind: 'entity', workspaceId, entityId }
          : { kind: 'workspace', workspaceId },
    [props.context, workspaceId, projectId, entityId]
  );
  const contentOperations = useContentScopeOperations(scope);

  const allTemplates =
    props.context === 'project'
      ? [
          ...(projectTemplateData?.projectTemplates ?? []),
          ...(projectTemplateData?.workspaceTemplates ?? [])
        ]
      : (workspaceOnlyTemplates ?? []);

  const templatesLoading =
    props.context === 'project' ? projectTemplatesLoading : workspaceTemplatesLoading;

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSelected('blank');
    setName('');
    setError('');
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
    const fallbackName = selected === 'blank' ? 'Untitled diagram' : selected.name;
    const finalName = trimmed || fallbackName;

    if (finalName.includes('/')) {
      setError('Name cannot contain /');
      return;
    }
    setError('');

    try {
      let file: ProjectFile;
      if (props.context === 'project') {
        if (selected !== 'blank') {
          file = await contentOperations.createDiagramFromTemplate.mutateAsync({
            name: finalName,
            templateFile: selected,
            folder
          });
        } else {
          file = await contentOperations.createDiagram.mutateAsync({ name: finalName, folder });
        }
      } else if (props.context === 'workspace') {
        file = await contentOperations.createDiagram.mutateAsync({ name: finalName, folder });
      } else {
        if (selected !== 'blank') {
          file = await contentOperations.createDiagramFromTemplate.mutateAsync({
            name: finalName,
            templateFile: selected,
            folder
          });
        } else {
          file = await contentOperations.createDiagram.mutateAsync({ name: finalName, folder });
        }
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

  const isPending =
    contentOperations.createDiagram.isPending ||
    contentOperations.createDiagramFromTemplate.isPending;

  const sub =
    props.context === 'project' && props.projectName ? (
      <span>
        Adds to <b>{props.projectName}</b>. Pick a template or start from a blank canvas.
      </span>
    ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sup="New diagram"
      title="Choose a starting point"
      sub={sub}
      width={640}
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
      <button
        type="button"
        className={`${styles.blankOption} ${selected === 'blank' ? styles.isActive : ''}`}
        onClick={() => setSelected('blank')}
      >
        <span className={styles.blankThumb}>
          <BlankPreview />
        </span>
        <span className={styles.blankText}>
          <span className={styles.blankName}>Blank canvas</span>
          <span className={styles.blankDesc}>No template — start from an empty diagram.</span>
        </span>
        <span className={styles.radio}>{selected === 'blank' && <TbCheck size={11} />}</span>
      </button>

      {!templatesLoading && allTemplates.length > 0 && (
        <>
          <div className={styles.divider}>
            <span>Start from a template</span>
          </div>

          <div className={styles.grid}>
            {allTemplates.map(t => {
              const isSelected = selected !== 'blank' && selected.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.card} ${isSelected ? styles.isActive : ''}`}
                  onClick={() => setSelected(t)}
                  title={t.name}
                >
                  <span className={styles.cardThumb}>
                    {t.preview_svg ? (
                      <div dangerouslySetInnerHTML={{ __html: t.preview_svg }} />
                    ) : (
                      <DummyPreview />
                    )}
                    {isSelected && (
                      <span className={styles.cardCheck}>
                        <TbCheck size={10} />
                      </span>
                    )}
                  </span>
                  <span className={styles.cardName}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className={styles.nameField}>
        <FormElement
          label="Diagram name"
          required={false}
          hint={folder ? `Will be created in ${folder}` : undefined}
          error={error}
        >
          <TextInput
            ref={nameRef}
            placeholder={selected === 'blank' ? 'Untitled diagram' : selected.name}
            value={name}
            onChange={value => setName(value ?? '')}
            style={{ width: '100%' }}
          />
        </FormElement>
      </div>
    </Dialog>
  );
};
