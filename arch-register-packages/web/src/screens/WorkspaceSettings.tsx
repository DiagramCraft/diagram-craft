import { useState, useCallback } from 'react';
import styles from './WorkspaceSettings.module.css';
import type { Workspace } from '../api';
import type { NavigateFn } from '../routing';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  AuditEntityType,
  AuditLogEntry,
  AuditOperation,
} from '../api';
import { TbChevronLeft, TbPlus, TbTrash } from 'react-icons/tb';
import { useAuditLog } from '../hooks/useAudit';
import { useUpdateWorkspace, useDeleteWorkspace } from '../hooks/useWorkspaces';
import { useUpdateLifecycleStates, useUpdateOwnerOptions } from '../hooks/useWorkspaceConfig';

type WorkspaceSettingsProps = {
  workspace: Workspace;
  section: string;
  navigate: NavigateFn;
  onWorkspaceUpdated: () => void;
  onWorkspaceDeleted: () => void;
  lifecycleStates: WorkspaceLifecycleState[];
  ownerOptions: WorkspaceOwnerOption[];
  onConfigUpdated: () => void;
  availableSections: string[];
};

const SECTION_META: Record<string, { title: string; sub: string }> = {
  general: { title: 'General', sub: 'Name, description, and identity for this workspace.' },
  'lifecycle-owners': { title: 'Lifecycle & Owners', sub: 'Configure valid lifecycle states and owner values for entities in this workspace.' },
  audit: { title: 'Audit log', sub: 'Browse recent activity across the workspace with filters for object type and date range.' },
  danger: { title: 'Danger zone', sub: 'Operations that can\'t be undone. Read carefully before clicking.' },
};

const COLOR_PRESETS = [
  { value: 'var(--ok)', label: 'Green' },
  { value: 'var(--accent)', label: 'Blue' },
  { value: 'var(--warn)', label: 'Yellow' },
  { value: 'var(--danger)', label: 'Red' },
  { value: 'var(--fg-3)', label: 'Grey' },
];

export const WorkspaceSettings = ({ workspace, section, navigate, onWorkspaceUpdated, onWorkspaceDeleted, lifecycleStates, ownerOptions, onConfigUpdated, availableSections }: WorkspaceSettingsProps) => {
  const meta = SECTION_META[section] ?? SECTION_META['general']!;

  if (!availableSections.includes(section)) {
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
              <div className={styles.title}>Workspace settings</div>
            </div>
            <div className={styles.sub}>No settings are available for your current permissions.</div>
          </div>
        </div>
      </div>
    );
  }

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
      {section === 'audit' && (
        <AuditLogSection workspace={workspace} navigate={navigate} />
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
  
  const updateWorkspaceMutation = useUpdateWorkspace();

  const isDirty =
    name !== workspace.name ||
    slug !== workspace.url_slug ||
    shortCode !== workspace.short_code ||
    description !== workspace.description;

  const handleSave = useCallback(async () => {
    try {
      await updateWorkspaceMutation.mutateAsync({
        workspaceId: workspace.id,
        data: { name, url_slug: slug, short_code: shortCode, description },
      });
      onWorkspaceUpdated();
    } catch {
      // Error handling could be improved
    }
  }, [workspace.id, name, slug, shortCode, description, updateWorkspaceMutation, onWorkspaceUpdated]);

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
        <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={!isDirty || updateWorkspaceMutation.isPending}>
          {updateWorkspaceMutation.isPending ? 'Saving...' : 'Save changes'}
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
  
  const updateLifecycleStatesMutation = useUpdateLifecycleStates(workspace.url_slug);
  const updateOwnerOptionsMutation = useUpdateOwnerOptions(workspace.url_slug);

  const statesDirty = JSON.stringify(states) !== JSON.stringify(lifecycleStates.map(s => ({ id: s.id, label: s.label, color: s.color })));
  const ownersDirty = JSON.stringify(owners) !== JSON.stringify(ownerOptions.map(o => ({ id: o.id })));
  const isDirty = statesDirty || ownersDirty;

  const handleCancel = () => {
    setStates(lifecycleStates.map(s => ({ id: s.id, label: s.label, color: s.color })));
    setOwners(ownerOptions.map(o => ({ id: o.id })));
  };

  const handleSave = useCallback(async () => {
    try {
      if (statesDirty) {
        await updateLifecycleStatesMutation.mutateAsync(
          states.map((s, i) => ({ id: s.id, label: s.label, color: s.color, sort_order: i }))
        );
      }
      if (ownersDirty) {
        await updateOwnerOptionsMutation.mutateAsync(
          owners.map((o, i) => ({ id: o.id, sort_order: i }))
        );
      }
      onConfigUpdated();
    } catch {
      // Error handling could be improved
    }
  }, [states, owners, statesDirty, ownersDirty, updateLifecycleStatesMutation, updateOwnerOptionsMutation, onConfigUpdated]);

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
        <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={!isDirty || updateLifecycleStatesMutation.isPending || updateOwnerOptionsMutation.isPending}>
          {(updateLifecycleStatesMutation.isPending || updateOwnerOptionsMutation.isPending) ? 'Saving...' : 'Save changes'}
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

const AUDIT_ENTITY_TYPES: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'All object types' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'entity_schema', label: 'Schema' },
  { value: 'entity', label: 'Entity' },
  { value: 'project', label: 'Project' },
  { value: 'project_file', label: 'Diagram / folder' },
];

const AUDIT_OPERATIONS: Array<{ value: '' | AuditOperation; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
];

const OPERATION_LABELS: Record<AuditOperation, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  entity: 'entity',
  project: 'project',
  project_file: 'diagram',
  entity_schema: 'schema',
  workspace: 'workspace',
};

const ENTITY_TYPE_TONES: Record<AuditEntityType, string> = {
  workspace: styles.typeWorkspace ?? '',
  entity_schema: styles.typeSchema ?? '',
  entity: styles.typeEntity ?? '',
  project: styles.typeProject ?? '',
  project_file: styles.typeFile ?? '',
};

const getOperationLabel = (operation: AuditOperation): string => OPERATION_LABELS[operation];

const getEntityTypeLabel = (entityType: AuditEntityType): string => ENTITY_TYPE_LABELS[entityType];

const getEntityTypeTone = (entityType: AuditEntityType): string => ENTITY_TYPE_TONES[entityType];

const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

const toStartOfDay = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const toEndOfDay = (date: string) => new Date(`${date}T23:59:59.999`).toISOString();

const AuditLogSection = ({ workspace, navigate }: { workspace: Workspace; navigate: NavigateFn }) => {
  const [entityType, setEntityType] = useState<'' | AuditEntityType>('');
  const [operation, setOperation] = useState<'' | AuditOperation>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Use TanStack Query for audit log fetching
  const { data: entries = [], isLoading: loading } = useAuditLog(workspace.url_slug, {
    entityType: entityType || null,
    operation: operation || null,
    startDate: startDate ? toStartOfDay(startDate) : null,
    endDate: endDate ? toEndOfDay(endDate) : null,
    limit: 100,
  });

  const handleEntryClick = (entry: AuditLogEntry) => {
    switch (entry.entity_type) {
      case 'entity':
        navigate({ view: 'entity-detail', entityId: entry.entity_id });
        return;
      case 'project':
        navigate({ view: 'project-detail', projectId: entry.entity_id, projectSidebarTab: 'projects', folderFilter: null });
        return;
      case 'entity_schema':
        navigate({ view: 'data-model' });
        return;
      case 'project_file': {
        const projectId = typeof entry.metadata['project_id'] === 'string' ? entry.metadata['project_id'] : null;
        const path = typeof entry.metadata['path'] === 'string' ? entry.metadata['path'] : null;
        const folderFilter = path?.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
        if (projectId) {
          navigate({ view: 'project-detail', projectId, projectSidebarTab: 'projects', folderFilter });
        }
      }
    }
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.auditFilters}>
        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <select
              aria-label="Object type"
              className={styles.input}
              value={entityType}
              onChange={e => setEntityType(e.target.value as '' | AuditEntityType)}
            >
              {AUDIT_ENTITY_TYPES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <select
              aria-label="Action"
              className={styles.input}
              value={operation}
              onChange={e => setOperation(e.target.value as '' | AuditOperation)}
            >
              {AUDIT_OPERATIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <input
              aria-label="From"
              className={styles.input}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <input
              aria-label="To"
              className={styles.input}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>

      </div>

      <div className={styles.section}>
        <div className={`${styles.sectionBody} ${styles.auditSectionBody}`}>
          <div className={styles.activityList}>
            {loading ? (
              <div className={styles.emptyState}>Loading activity...</div>
            ) : entries.length > 0 ? (
              entries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className={styles.activityRow}
                  onClick={() => handleEntryClick(entry)}
                >
                  <span className={`${styles.activityTypeBadge} ${getEntityTypeTone(entry.entity_type)}`}>
                    {getEntityTypeLabel(entry.entity_type)}
                  </span>
                  <span className={styles.activityDate}>{formatRelativeTime(entry.timestamp)}</span>
                  <span className={styles.activityWho}>{entry.user_id}</span>
                  <span className={styles.activityVerb}>{getOperationLabel(entry.operation)}</span>
                  <span className={styles.activityTarget}>{entry.entity_name}</span>
                </button>
              ))
            ) : (
              <div className={styles.emptyState}>No audit log entries match the current filters.</div>
            )}
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
  
  const deleteWorkspaceMutation = useDeleteWorkspace();

  const canDelete = confirm === workspace.name;

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    try {
      await deleteWorkspaceMutation.mutateAsync(workspace.id);
      onWorkspaceDeleted();
      navigate({ view: 'home', workspaceId: null });
    } catch {
      // Error handling could be improved
    }
  }, [workspace.id, canDelete, deleteWorkspaceMutation, navigate, onWorkspaceDeleted]);

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
            disabled={!canDelete || deleteWorkspaceMutation.isPending}
            onClick={handleDelete}
          >
            {deleteWorkspaceMutation.isPending ? 'Deleting...' : 'Delete workspace'}
          </button>
        </div>
      </div>
    </div>
  );
};