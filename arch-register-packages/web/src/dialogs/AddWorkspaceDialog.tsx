import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormSection } from '@diagram-craft/app-components/FormSection';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { apiFetch, ApiError } from '../lib/api';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ColorPicker } from '../components/ColorPicker';
import styles from './AddWorkspaceDialog.module.css';
import { Workspace } from '@arch-register/api-types/workspaces';

type ApiWorkspace = {
  id: string;
  name: string;
  url_slug: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type AddWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: ApiWorkspace) => void;
};

const TEMPLATES = [
  {
    id: 'backstage',
    name: 'Backstage',
    desc: 'CNCF Software Catalog model.',
    types: ['Domain', 'System', 'Component', 'API', 'Resource']
  },
  {
    id: 'c4',
    name: 'C4 Model',
    desc: 'C4 Model by Simon Brown.',
    types: ['Person', 'Software System', 'Container', 'Component']
  },
  {
    id: 'itil',
    name: 'CMDB / ITIL',
    desc: 'IT Service Management.',
    types: ['Organization', 'Business Service', 'Application', 'Database', 'Host']
  },
  {
    id: 'ddd',
    name: 'Domain-Driven',
    desc: 'Simple DDD-inspired model.',
    types: ['Domain', 'Team', 'Service', 'Event']
  },
  {
    id: 'team-topologies',
    name: 'Team Topologies',
    desc: "Conway's Law model.",
    types: ['Team', 'System', 'Team Interaction']
  },
  {
    id: 'data-mesh',
    name: 'Data Mesh',
    desc: 'Data Mesh by Zhamak Dehghani.',
    types: ['Domain', 'Data Product', 'Dataset', 'Pipeline', 'Source System']
  },
  {
    id: 'archimate',
    name: 'ArchiMate / TOGAF',
    desc: 'The Open Group EA framework.',
    types: [
      'Business Capability',
      'Business Process',
      'Application Component',
      'Application Service',
      'Technology Component'
    ]
  },
  {
    id: 'security',
    name: 'Security / Threat Model',
    desc: 'STRIDE-adjacent model.',
    types: ['Asset', 'Control', 'Threat', 'Risk']
  }
];

const COPY_PARTS = [
  { id: 'schemas', label: 'Data model', default: true },
  { id: 'projects', label: 'Projects & diagrams', default: false },
  { id: 'members', label: 'Members & roles', default: false },
  { id: 'settings', label: 'Settings', default: true }
];

type Mode = 'blank' | 'template' | 'copy';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function initialsOf(s: string) {
  if (!s) return '';
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]![0] ?? '') + (parts[1]![0] ?? '')).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase();
}

export const AddWorkspaceDialog = ({ open, onClose, onCreated }: AddWorkspaceDialogProps) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [badgeDirty, setBadgeDirty] = useState(false);
  const [badge, setBadge] = useState('');
  const [color, setColor] = useState(SCHEMA_COLORS[0]!);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<Mode>('blank');
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyParts, setCopyParts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COPY_PARTS.map(p => [p.id, p.default]))
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSlug('');
    setBadge('');
    setDescription('');
    setBadgeDirty(false);
    setColor(SCHEMA_COLORS[0]!);
    setMode('blank');
    setTemplateId(TEMPLATES[0]!.id);
    setWorkspaces([]);
    setCopyFrom('');
    setCopyParts(Object.fromEntries(COPY_PARTS.map(p => [p.id, p.default])));
    setError('');
    setTimeout(() => nameRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    setSlug(slugify(name));
    if (!badgeDirty) setBadge(initialsOf(name));
  }, [name, badgeDirty]);

  useEffect(() => {
    if (mode === 'copy' && workspaces.length === 0) {
      apiFetch<Workspace[]>('/api/workspaces')
        .then(ws => {
          setWorkspaces(ws);
          if (ws.length > 0) setCopyFrom(ws[0]!.id);
        })
        .catch(() => {});
    }
  }, [mode, workspaces.length]);

  const canCreate = name.trim().length > 0 && slug.length > 0 && (mode !== 'copy' || !!copyFrom);

  const handleSubmit = useCallback(async () => {
    if (!canCreate) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug,
        badge: badge || initialsOf(name),
        color,
        description: description.trim()
      };
      if (mode === 'template') body['template'] = templateId;
      if (mode === 'copy') {
        body['replicate_from'] = copyFrom;
        body['include'] = Object.keys(copyParts).filter(k => copyParts[k]);
      }
      const ws = await apiFetch<ApiWorkspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onCreated(ws);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    canCreate,
    name,
    slug,
    badge,
    color,
    description,
    mode,
    templateId,
    copyFrom,
    copyParts,
    onCreated,
    onClose
  ]);

  const activeTemplate = TEMPLATES.find(t => t.id === templateId);
  const fromWs = workspaces.find(w => w.id === copyFrom);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sup="New workspace"
      title="Create a workspace"
      width={620}
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
          label: submitting ? 'Creating...' : 'Create workspace',
          type: 'default',
          disabled: !canCreate || submitting,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <div className={styles.body}>
        <FormSection step={1} title="Identity">
          <div className={styles.identity}>
            <div className={styles.badgeCol}>
              <div
                className={styles.badgePreview}
                style={{
                  background: color
                    ? `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 60%, oklch(0.35 0.12 290)))`
                    : 'var(--cmp-bg-hover)'
                }}
              >
                {badge || '—'}
              </div>
              <input
                className={styles.badgeInput}
                value={badge}
                maxLength={2}
                placeholder="AB"
                title="2-character badge"
                onChange={e => {
                  setBadge(e.target.value.toUpperCase());
                  setBadgeDirty(true);
                }}
              />
              <span className={styles.badgeHint}>2 chars</span>
            </div>

            <div className={styles.fields}>
              <FormElement label="Workspace name">
                <TextInput
                  ref={nameRef}
                  placeholder="e.g. Acme Payments Platform"
                  value={name}
                  onChange={value => setName(value ?? '')}
                  style={{ width: '100%' }}
                />
              </FormElement>

              <FormElement label="Color">
                <ColorPicker
                  value={color}
                  onChange={v => setColor(v ?? SCHEMA_COLORS[0]!)}
                  size="small"
                />
              </FormElement>

              <FormElement label="Description">
                <TextArea
                  placeholder="What lives in this workspace? Who owns it?"
                  value={description}
                  onChange={value => setDescription(value ?? '')}
                  rows={3}
                  style={{ width: '100%' }}
                  allowMaximize={false}
                />
              </FormElement>
            </div>
          </div>
        </FormSection>

        <FormSection step={2} title="Schema setup">
          <ModeSwitcher
            modes={[
              { value: 'blank', label: 'Start blank' },
              { value: 'template', label: 'Template' },
              { value: 'copy', label: 'Copy' }
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'blank' && (
            <div className={styles.note}>
              Starts with no entity types. You'll define your own data model from scratch in the
              Data model editor.
            </div>
          )}

          {mode === 'template' && (
            <>
              <div className={styles.templateGrid}>
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.templateCard} ${templateId === t.id ? styles.templateCardActive : ''}`}
                    onClick={() => setTemplateId(t.id)}
                  >
                    <div className={styles.templateCardHead}>
                      <span className={styles.templateCardName}>{t.name}</span>
                      {templateId === t.id && <span className={styles.templateCardCheck}>✓</span>}
                    </div>
                    <div className={styles.templateCardDesc}>{t.desc}</div>
                    <div className={`${styles.templateCardMeta} ${styles.mono}`}>
                      {t.types.length} entity types
                    </div>
                  </button>
                ))}
              </div>
              {activeTemplate && (
                <div className={styles.note}>
                  <strong>{activeTemplate.name}</strong> seeds: {activeTemplate.types.join(', ')}.
                </div>
              )}
            </>
          )}

          {mode === 'copy' && (
            <div className={styles.copyPanel}>
              <FormElement label="Copy from">
                <Select.Root
                  value={copyFrom || undefined}
                  onChange={value => setCopyFrom(value ?? '')}
                  placeholder={workspaces.length === 0 ? 'Loading…' : 'Select workspace'}
                  style={{ width: '100%' }}
                >
                  {workspaces.map(ws => (
                    <Select.Item key={ws.id} value={ws.id}>
                      {ws.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
              <FormElement label="Include">
                <div className={styles.copyInclude}>
                  {COPY_PARTS.map(p => (
                    <label key={p.id} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={!!copyParts[p.id]}
                        onChange={e =>
                          setCopyParts(prev => ({ ...prev, [p.id]: e.target.checked }))
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </FormElement>
              {fromWs && (
                <div className={styles.note}>
                  Replicates the selected parts of <strong>{fromWs.name}</strong>. Changes won't
                  sync back.
                </div>
              )}
            </div>
          )}
        </FormSection>

        {error && <div className={styles.errorBar}>{error}</div>}
      </div>
    </Dialog>
  );
};
