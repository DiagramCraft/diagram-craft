import { useState, useCallback, useEffect } from 'react';
import styles from './WorkspaceSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { LIFECYCLE_COLOR_PRESETS, SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ColorPicker } from '../../components/ColorPicker';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { AuditEntityType, AuditOperation } from '../../lib/api';
import { TbChevronLeft, TbPlus, TbTrash } from 'react-icons/tb';
import { useAuditLog } from '../../hooks/useAudit';
import { useUpdateWorkspace, useDeleteWorkspace } from '../../hooks/useWorkspaces';
import { useUpdateLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { RolesPermissionsSubSection } from './sub-sections/RolesPermissionsSubSection';
import { MembersSubSection } from './sub-sections/MembersSubSection';
import { TeamsSubSection } from './sub-sections/TeamsSubSection';
import { AiSettingsSubSection } from './sub-sections/AiSettingsSubSection';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';

const SECTION_META: Record<string, { title: string; sub: string }> = {
  'general': { title: 'General', sub: 'Name, description, and identity for this workspace.' },
  'lifecycle-owners': {
    title: 'Lifecycle',
    sub: 'Configure valid lifecycle states for entities in this workspace.'
  },
  'roles': {
    title: 'Roles & permissions',
    sub: 'Manage built-in roles and create custom workspace roles.'
  },
  'teams': {
    title: 'Teams',
    sub: 'Manage owner teams and assign users a team role for owned entities and projects.'
  },
  'members': {
    title: 'Members',
    sub: 'Browse workspace members and the role assigned to each person.'
  },
  'ai': {
    title: 'AI',
    sub: 'Configure the AI provider, model, and system prompt for the Assistant and Extract features.'
  },
  'audit': {
    title: 'Audit log',
    sub: 'Browse recent activity across the workspace with filters for object type and date range.'
  },
  'danger': {
    title: 'Danger zone',
    sub: "Operations that can't be undone. Read carefully before clicking."
  }
};

export const WorkspaceSettingsScreen = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: string };
  const ctx = useWorkspaceContext();
  const workspace = ctx.workspace;
  const workspaceSlug = ctx.workspaceSlug;
  const lifecycleStates = ctx.lifecycleStates;
  const availableSections = ctx.availableSettingsSections;
  const section = availableSections.includes(search.section ?? '')
    ? (search.section ?? 'general')
    : (ctx.defaultSettingsSection ?? 'general');
  const [membersAddDialogOpen, setMembersAddDialogOpen] = useState(false);
  const [teamsAddDialogOpen, setTeamsAddDialogOpen] = useState(false);
  const [rolesAddDialogOpen, setRolesAddDialogOpen] = useState(false);

  const meta = SECTION_META[section] ?? SECTION_META['general']!;

  if (!workspace) return null;

  if (!availableSections.includes(section)) {
    return (
      <div className={styles.screen}>
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })}
            >
              <TbChevronLeft size={12} /> {workspace.name}
            </button>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Workspace settings</span>
            <div className={styles.titleRow}>
              <div className={styles.title}>Workspace settings</div>
            </div>
            <div className={styles.sub}>
              No settings are available for your current permissions.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })}
          >
            <TbChevronLeft size={12} /> {workspace.name}
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Workspace settings</span>
          <div className={styles.titleRow}>
            <div className={styles.title}>{meta.title}</div>
          </div>
          <div className={styles.sub}>{meta.sub}</div>
        </div>
        {section === 'members' && (
          <div className={styles.headActions}>
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => setMembersAddDialogOpen(true)}
            >
              Add user
            </Button>
          </div>
        )}
        {section === 'teams' && (
          <div className={styles.headActions}>
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => setTeamsAddDialogOpen(true)}
            >
              Add team
            </Button>
          </div>
        )}
        {section === 'roles' && (
          <div className={styles.headActions}>
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => setRolesAddDialogOpen(true)}
            >
              New custom role
            </Button>
          </div>
        )}
      </div>

      {section === 'general' && <GeneralSection workspace={workspace} />}
      {section === 'lifecycle-owners' && (
        <LifecycleOwnersSection workspace={workspace} lifecycleStates={lifecycleStates} />
      )}
      {section === 'roles' && (
        <RolesPermissionsSubSection
          workspaceSlug={workspaceSlug}
          createDialogOpen={rolesAddDialogOpen}
          onCloseCreateDialog={() => setRolesAddDialogOpen(false)}
        />
      )}
      {section === 'teams' && (
        <TeamsSubSection
          workspaceSlug={workspaceSlug}
          addDialogOpen={teamsAddDialogOpen}
          onCloseAddDialog={() => setTeamsAddDialogOpen(false)}
        />
      )}
      {section === 'members' && (
        <MembersSubSection
          workspaceSlug={workspaceSlug}
          addDialogOpen={membersAddDialogOpen}
          onCloseAddDialog={() => setMembersAddDialogOpen(false)}
        />
      )}
      {section === 'ai' && <AiSettingsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'audit' && (
        <AuditLogSection workspace={workspace} workspaceSlug={workspaceSlug} />
      )}
      {section === 'danger' && <DangerSection workspace={workspace} />}
    </div>
  );
};

const GeneralSection = ({ workspace }: { workspace: Workspace }) => {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.url_slug);
  const [shortCode, setShortCode] = useState(workspace.short_code);
  const [color, setColor] = useState(workspace.color ?? '');
  const [description, setDescription] = useState(workspace.description);

  const updateWorkspaceMutation = useUpdateWorkspace();

  const isDirty =
    name !== workspace.name ||
    slug !== workspace.url_slug ||
    shortCode !== workspace.short_code ||
    color !== (workspace.color ?? '') ||
    description !== workspace.description;

  const handleSave = useCallback(async () => {
    try {
      await updateWorkspaceMutation.mutateAsync({
        workspaceId: workspace.id,
        data: { name, url_slug: slug, short_code: shortCode, color, description }
      });
    } catch {
      // Error handling could be improved
    }
  }, [workspace.id, name, slug, shortCode, color, description, updateWorkspaceMutation]);

  const handleCancel = () => {
    setName(workspace.name);
    setSlug(workspace.url_slug);
    setShortCode(workspace.short_code);
    setColor(workspace.color ?? '');
    setDescription(workspace.description);
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button onClick={handleCancel} disabled={!isDirty}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || updateWorkspaceMutation.isPending}
        >
          {updateWorkspaceMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
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
              <div className={styles.fieldHint}>
                Shown in the top-left switcher and on shared links.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={name}
                onChange={value => setName(value ?? '')}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>URL slug</div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={slug}
                onChange={value => setSlug(value ?? '')}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Short code</div>
              <div className={styles.fieldHint}>
                Two-letter badge used in tight UI like the switcher.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={shortCode}
                onChange={value => setShortCode((value ?? '').toUpperCase().slice(0, 2))}
                style={{ width: 80, fontFamily: 'var(--mono)' }}
                maxLength={2}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Color</div>
              <div className={styles.fieldHint}>Badge accent color in the workspace switcher.</div>
            </div>
            <div className={styles.fieldRight}>
              <ColorPicker
                value={color}
                onChange={v => setColor(v ?? SCHEMA_COLORS[0]!)}
                size="small"
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Description</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={description}
                onChange={value => setDescription(value ?? '')}
                rows={5}
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

const buildLifecycleStateDraft = (lifecycleStates: WorkspaceLifecycleState[]) =>
  lifecycleStates.map(state => ({ id: state.id, label: state.label, color: state.color }));

const COLOR_PRESETS = LIFECYCLE_COLOR_PRESETS;

const LifecycleOwnersSection = ({
  workspace,
  lifecycleStates
}: {
  workspace: Workspace;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const [states, setStates] = useState<EditLifecycleState[]>(() =>
    buildLifecycleStateDraft(lifecycleStates)
  );

  const updateLifecycleStatesMutation = useUpdateLifecycleStates(workspace.url_slug);

  useEffect(() => {
    setStates(buildLifecycleStateDraft(lifecycleStates));
  }, [lifecycleStates]);

  const initialStates = buildLifecycleStateDraft(lifecycleStates);
  const statesDirty = JSON.stringify(states) !== JSON.stringify(initialStates);
  const isDirty = statesDirty;

  const handleCancel = () => {
    setStates(initialStates);
  };

  const handleSave = useCallback(async () => {
    try {
      if (statesDirty) {
        await updateLifecycleStatesMutation.mutateAsync(
          states.map((s, i) => ({ id: s.id, label: s.label, color: s.color, sort_order: i }))
        );
      }
    } catch {
      // Error handling could be improved
    }
  }, [states, statesDirty, updateLifecycleStatesMutation]);

  const updateState = (index: number, patch: Partial<EditLifecycleState>) =>
    setStates(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const removeState = (index: number) => setStates(prev => prev.filter((_, i) => i !== index));

  const addState = () =>
    setStates(prev => [...prev, { id: '', label: '', color: 'var(--cmp-fg-disabled)' }]);

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button onClick={handleCancel} disabled={!isDirty}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || updateLifecycleStatesMutation.isPending}
        >
          {updateLifecycleStatesMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Lifecycle states</div>
          <div className={styles.sectionSub}>
            Define the lifecycle stages an entity can be in. Each state has a machine key, a display
            label, and a color.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {states.map((s, i) => (
            <div
              key={i}
              className={styles.field}
              style={{ gridTemplateColumns: '1fr 1fr auto auto' }}
            >
              <div className={styles.fieldRight}>
                <TextInput
                  value={s.id}
                  onChange={value =>
                    updateState(i, { id: (value ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                  }
                  placeholder="key (e.g. production)"
                  style={{ fontFamily: 'var(--mono)' }}
                />
              </div>
              <div className={styles.fieldRight}>
                <TextInput
                  value={s.label}
                  onChange={value => updateState(i, { label: value ?? '' })}
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
                      border:
                        s.color === c.value ? '2px solid var(--base-fg)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0
                    }}
                  />
                ))}
              </div>
              <Button onClick={() => removeState(i)} style={{ padding: '0 6px' }}>
                <TbTrash size={12} />
              </Button>
            </div>
          ))}
          <Button icon={<TbPlus size={12} />} onClick={addState} style={{ marginTop: 8 }}>
            Add state
          </Button>
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
  { value: 'content_node', label: 'Diagram / folder' }
];

const AUDIT_OPERATIONS: Array<{ value: '' | AuditOperation; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' }
];

const OPERATION_LABELS: Record<AuditOperation, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted'
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  entity: 'entity',
  project: 'project',
  content_node: 'diagram',
  entity_schema: 'schema',
  workspace: 'workspace'
};

const ENTITY_TYPE_TONES: Record<AuditEntityType, string> = {
  workspace: styles.typeWorkspace ?? '',
  entity_schema: styles.typeSchema ?? '',
  entity: styles.typeEntity ?? '',
  project: styles.typeProject ?? '',
  content_node: styles.typeFile ?? ''
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

const AuditLogSection = ({
  workspace,
  workspaceSlug
}: {
  workspace: Workspace;
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
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
    limit: 100
  });

  const handleEntryClick = (entry: AuditLogEntry) => {
    switch (entry.entity_type) {
      case 'entity':
        navigate({
          to: '/$workspaceSlug/entities/$entityId',
          params: { workspaceSlug, entityId: entry.entity_id }
        });
        return;
      case 'project':
        navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug, projectId: entry.entity_id },
          search: { tab: 'projects' as const, section: 'home' as const }
        });
        return;
      case 'entity_schema':
        navigate({ to: '/$workspaceSlug/model', params: { workspaceSlug } });
        return;
      case 'content_node': {
        const projectId =
          typeof entry.metadata['project_id'] === 'string' ? entry.metadata['project_id'] : null;
        const path = typeof entry.metadata['path'] === 'string' ? entry.metadata['path'] : null;
        const folderFilter = path?.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null;
        if (projectId) {
          navigate({
            to: '/$workspaceSlug/projects/$projectId',
            params: { workspaceSlug, projectId },
            search: {
              tab: 'projects' as const,
              section: 'home' as const,
              folder: folderFilter ?? undefined
            }
          });
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
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
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
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
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
                  <span
                    className={`${styles.activityTypeBadge} ${getEntityTypeTone(entry.entity_type)}`}
                  >
                    {getEntityTypeLabel(entry.entity_type)}
                  </span>
                  <span className={styles.activityDate}>{formatRelativeTime(entry.timestamp)}</span>
                  <span className={styles.activityWho}>
                    {entry.user_display_name ?? entry.user_id ?? 'Unknown'}
                  </span>
                  <span className={styles.activityVerb}>{getOperationLabel(entry.operation)}</span>
                  <span className={styles.activityTarget}>{entry.entity_name}</span>
                </button>
              ))
            ) : (
              <div className={styles.emptyState}>
                No audit log entries match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DangerSection = ({ workspace }: { workspace: Workspace }) => {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');

  const deleteWorkspaceMutation = useDeleteWorkspace();

  const canDelete = confirm === workspace.name;

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    try {
      await deleteWorkspaceMutation.mutateAsync(workspace.id);
      navigate({ to: '/' });
    } catch {
      // Error handling could be improved
    }
  }, [workspace.id, canDelete, deleteWorkspaceMutation, navigate]);

  return (
    <div className={styles.blockList}>
      <div className={styles.dangerCard}>
        <div className={styles.dangerCardBody}>
          <div className={styles.dangerCardTitle}>Delete workspace permanently</div>
          <div className={styles.dangerCardText}>
            This will permanently erase <strong>{workspace.name}</strong> — every project, entity,
            diagram and integration. This cannot be undone.
          </div>
          <div className={styles.dangerCardControls}>
            <div className={styles.fieldLabel}>Type the workspace name to confirm</div>
            <TextInput
              placeholder={workspace.name}
              value={confirm}
              onChange={value => setConfirm(value ?? '')}
              style={{ maxWidth: 320, fontFamily: 'var(--mono)' }}
            />
          </div>
        </div>
        <div className={styles.dangerCardActions}>
          <Button
            variant="danger"
            disabled={!canDelete || deleteWorkspaceMutation.isPending}
            onClick={handleDelete}
          >
            {deleteWorkspaceMutation.isPending ? 'Deleting...' : 'Delete workspace'}
          </Button>
        </div>
      </div>
    </div>
  );
};
