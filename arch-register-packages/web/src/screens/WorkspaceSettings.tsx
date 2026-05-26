import { useState, useCallback } from 'react';
import styles from './WorkspaceSettings.module.css';
import type { Workspace } from '../data';
import type { NavigateFn } from '../routing';
import { apiFetch } from '../api';
import { TbChevronLeft } from 'react-icons/tb';

type WorkspaceSettingsProps = {
  workspace: Workspace;
  section: string;
  navigate: NavigateFn;
  onWorkspaceUpdated: () => void;
  onWorkspaceDeleted: () => void;
};

const SECTION_META: Record<string, { title: string; sub: string }> = {
  general: { title: 'General', sub: 'Name, description, and identity for this workspace.' },
  danger: { title: 'Danger zone', sub: 'Operations that can\'t be undone. Read carefully before clicking.' },
};

export const WorkspaceSettings = ({ workspace, section, navigate, onWorkspaceUpdated, onWorkspaceDeleted }: WorkspaceSettingsProps) => {
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
