import { useState, useCallback } from 'react';
import styles from './WorkspaceSettings.module.css';
import type { Workspace } from '../api';
import type { NavigateFn } from '../routing';
import { apiFetch, updateLifecycleStates, updateOwnerOptions } from '../api';
import type { WorkspaceLifecycleState, WorkspaceOwnerOption } from '../api';
import { TbChevronLeft, TbPlus, TbTrash } from 'react-icons/tb';

type WorkspaceSettingsProps = {
  workspace: Workspace;
  section: string;
  navigate: NavigateFn;
  onWorkspaceUpdated: () => void;
  onWorkspaceDeleted: () => void;
  lifecycleStates: WorkspaceLifecycleState[];
  ownerOptions: WorkspaceOwnerOption[];
  onConfigUpdated: () => void;
};

const SECTION_META: Record<string, { title: string; sub: string }> = {
  general: { title: 'General', sub: 'Name, description, and identity for this workspace.' },
  'lifecycle-owners': { title: 'Lifecycle & Owners', sub: 'Configure valid lifecycle states and owner values for entities in this workspace.' },
  danger: { title: 'Danger zone', sub: 'Operations that can\'t be undone. Read carefully before clicking.' },
};

const COLOR_PRESETS = [
  { value: 'var(--ok)', label: 'Green' },
  { value: 'var(--accent)', label: 'Blue' },
  { value: 'var(--warn)', label: 'Yellow' },
  { value: 'var(--danger)', label: 'Red' },
  { value: 'var(--fg-3)', label: 'Grey' },
];

export const WorkspaceSettings = ({ workspace, section, navigate, onWorkspaceUpdated, onWorkspaceDeleted, lifecycleStates, ownerOptions, onConfigUpdated }: WorkspaceSettingsProps) => {
  const meta = SECTION_META[section] ?? SECTION_META['general']!;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <button type="button" className={styles.backLink} onClick={() => navigate({ view: 'home' })}>
            <TbChevronLeft size={12} /> {workspace.name}
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Workspace settings</span>
          <div className={styles.titleRow}>
            <div className={styles.title}>{meta.title}</div>
          </div>
          <div className={styles.sub}>{meta.sub}</div>
        </div>
      </div>

      {section === 'general' && (
        <GeneralSection workspace={workspace} onWorkspaceUpdated={onWorkspaceUpdated} />
      )}
      {section === 'lifecycle-owners' && (
        <LifecycleOwnersSection
          workspace={workspace}
          lifecycleStates={lifecycleStates}
          ownerOptions={ownerOptions}
          onConfigUpdated={onConfigUpdated}
        />
      )}
      {section === 'danger' && (
        <DangerSection workspace={workspace} navigate={navigate} onWorkspaceDeleted={onWorkspaceDeleted} />
      )}
    </div>
  );
};

const GeneralSection = ({ workspace, onWorkspaceUpdated }: { workspace: Workspace; onWorkspaceUpdated: () => void }) => {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.url_slug);
  const [shortCode, setShortCode] = useState(workspace.short_code);
  const [description, setDescription] = useState(workspace.description);
  const [saving, setSaving] = useState(false);

  const isDirty =
    name !== workspace.name ||
    slug !== workspace.url_slug ||
    shortCode !== workspace.short_code ||
    description !== workspace.description;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, url_slug: slug, short_code: shortCode, description }),
      });
      onWorkspaceUpdated();
    } finally {
      setSaving(false);
    }
  }, [workspace.id, name, slug, shortCode, description, onWorkspaceUpdated]);

  const handleCancel = () => {
    setName(workspace.name);
    setSlug(workspace.url_slug);
    setShortCode(workspace.short_code);
    setDescription(workspace.description);
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <button type="button" className={styles.btn} onClick={handleCancel} disabled={!isDirty}>Cancel</button>
        <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Identity</div>
          <div className={styles.sectionSub}>How this workspace appears to members.</div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Workspace name</div>
              <div className={styles.fieldHint}>Shown in the top-left switcher and on shared links.</div>
            </div>
            <div className={styles.fieldRight}>
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>URL slug</div>
            </div>
            <div className={styles.fieldRight}>
              <input
                className={styles.input}
                value={slug}
                onChange={e => setSlug(e.target.value)}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Short code</div>
              <div className={styles.fieldHint}>Two-letter badge used in tight UI like the switcher.</div>
            </div>
            <div className={styles.fieldRight}>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={shortCode}
                onChange={e => setShortCode(e.target.value.toUpperCase().slice(0, 2))}
                style={{ width: 80 }}
                maxLength={2}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Description</div>
            </div>
            <div className={styles.fieldRight}>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type EditLifecycleState = {
  id: string;
  label: string;
  color: string;
};

type EditOwner = {
  id: string;
};

const LifecycleOwnersSection = ({
  workspace,
  lifecycleStates,
  ownerOptions,
  onConfigUpdated,
}: {
  workspace: Workspace;
  lifecycleStates: WorkspaceLifecycleState[];
  ownerOptions: WorkspaceOwnerOption[];
  onConfigUpdated: () => void;
}) => {
  const [states, setStates] = useState<EditLifecycleState[]>(() =>
    lifecycleStates.map(s => ({ id: s.id, label: s.label, color: s.color }))
  );
  const [owners, setOwners] = useState<EditOwner[]>(() =>
    ownerOptions.map(o => ({ id: o.id }))
  );
  const [saving, setSaving] = useState(false);

  const statesDirty = JSON.stringify(states) !== JSON.stringify(lifecycleStates.map(s => ({ id: s.id, label: s.label, color: s.color })));
  const ownersDirty = JSON.stringify(owners) !== JSON.stringify(ownerOptions.map(o => ({ id: o.id })));
  const isDirty = statesDirty || ownersDirty;

  const handleCancel = () => {
    setStates(lifecycleStates.map(s => ({ id: s.id, label: s.label, color: s.color })));
    setOwners(ownerOptions.map(o => ({ id: o.id })));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (statesDirty) {
        await updateLifecycleStates(
          workspace.url_slug,
          states.map((s, i) => ({ id: s.id, label: s.label, color: s.color, sort_order: i }))
        );
      }
      if (ownersDirty) {
        await updateOwnerOptions(
          workspace.url_slug,
          owners.map((o, i) => ({ id: o.id, sort_order: i }))
        );
      }
      onConfigUpdated();
    } finally {
      setSaving(false);
    }
  }, [workspace.url_slug, states, owners, statesDirty, ownersDirty, onConfigUpdated]);

  const updateState = (index: number, patch: Partial<EditLifecycleState>) =>
    setStates(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s));

  const removeState = (index: number) =>
    setStates(prev => prev.filter((_, i) => i !== index));

  const addState = () =>
    setStates(prev => [...prev, { id: '', label: '', color: 'var(--fg-3)' }]);

  const updateOwner = (index: number, id: string) =>
    setOwners(prev => prev.map((o, i) => i === index ? { id } : o));

  const removeOwner = (index: number) =>
    setOwners(prev => prev.filter((_, i) => i !== index));

  const addOwner = () =>
    setOwners(prev => [...prev, { id: '' }]);

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <button type="button" className={styles.btn} onClick={handleCancel} disabled={!isDirty}>Cancel</button>
        <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Lifecycle states</div>
          <div className={styles.sectionSub}>Define the lifecycle stages an entity can be in. Each state has a machine key, a display label, and a color.</div>
        </div>
        <div className={styles.sectionBody}>
          {states.map((s, i) => (
            <div key={i} className={styles.field} style={{ gridTemplateColumns: '1fr 1fr auto auto' }}>
              <div className={styles.fieldRight}>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  value={s.id}
                  onChange={e => updateState(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="key (e.g. production)"
                />
              </div>
              <div className={styles.fieldRight}>
                <input
                  className={styles.input}
                  value={s.label}
                  onChange={e => updateState(i, { label: e.target.value })}
                  placeholder="Label (e.g. Production)"
                />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => updateState(i, { color: c.value })}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: c.value,
                      border: s.color === c.value ? '2px solid var(--fg-0)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <button type="button" className={styles.btn} onClick={() => removeState(i)} style={{ padding: '0 6px' }}>
                <TbTrash size={12} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.btn} onClick={addState} style={{ marginTop: 8 }}>
            <TbPlus size={12} /> Add state
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Owners</div>
          <div className={styles.sectionSub}>Define the valid owner values that can be assigned to entities.</div>
        </div>
        <div className={styles.sectionBody}>
          {owners.map((o, i) => (
            <div key={i} className={styles.field} style={{ gridTemplateColumns: '1fr auto' }}>
              <div className={styles.fieldRight}>
                <input
                  className={styles.input}
                  value={o.id}
                  onChange={e => updateOwner(i, e.target.value)}
                  placeholder="Owner name (e.g. platform-team)"
                  style={{ maxWidth: 340 }}
                />
              </div>
              <button type="button" className={styles.btn} onClick={() => removeOwner(i)} style={{ padding: '0 6px' }}>
                <TbTrash size={12} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.btn} onClick={addOwner} style={{ marginTop: 8 }}>
            <TbPlus size={12} /> Add owner
          </button>
        </div>
      </div>
    </div>
  );
};

const DangerSection = ({
  workspace,
  navigate,
  onWorkspaceDeleted,
}: {
  workspace: Workspace;
  navigate: NavigateFn;
  onWorkspaceDeleted: () => void;
}) => {
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirm === workspace.name;

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' });
      onWorkspaceDeleted();
      navigate({ view: 'home', workspaceId: null });
    } catch {
      setDeleting(false);
    }
  }, [workspace.id, workspace.name, canDelete, navigate, onWorkspaceDeleted]);

  return (
    <div className={styles.blockList}>
      <div className={styles.dangerCard}>
        <div className={styles.dangerCardBody}>
          <div className={styles.dangerCardTitle}>Delete workspace permanently</div>
          <div className={styles.dangerCardText}>
            This will permanently erase <strong>{workspace.name}</strong> — every project,
            entity, diagram and integration. This cannot be undone.
          </div>
          <div className={styles.dangerCardControls}>
            <div className={styles.fieldLabel}>Type the workspace name to confirm</div>
            <input
              className={`${styles.input} ${styles.mono}`}
              placeholder={workspace.name}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
        </div>
        <div className={styles.dangerCardActions}>
          <button
            type="button"
            className={styles.btnDanger}
            disabled={!canDelete || deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting...' : 'Delete workspace'}
          </button>
        </div>
      </div>
    </div>
  );
};
