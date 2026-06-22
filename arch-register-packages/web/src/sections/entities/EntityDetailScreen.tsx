import { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './EntityDetailScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import { Chip } from '../../components/Chip';
import {
  TbChevronLeft,
  TbChevronRight,
  TbEdit,
  TbDots,
  TbExternalLink,
  TbTrash,
  TbPlus,
  TbX,
  TbCopy,
  TbBell,
  TbPinned
} from 'react-icons/tb';
import { resolveSchemaColor, WorkspaceTeam } from '../../lib/api';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import {
  useEntity,
  useEntityRelations,
  useUpdateEntity,
  useDeleteEntity,
  useCloneEntity,
  useEntitiesBySchema,
  useEntitySnapshots,
  usePromoteSnapshot,
  useRestoreSnapshot
} from '../../hooks/useEntities';
import { useEntityDiagramFiles, useEntityProjects } from '../../hooks/useProjects';
import { useAuditLog } from '../../hooks/useAudit';
import {
  useCreatePinnedEntity,
  useCreateWatch,
  useDeletePinnedEntity,
  useDeleteWatch,
  usePinnedEntities,
  useWatchedEntities
} from '../../hooks/useNotifications';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDiagramHref
} from '../../routes/publicObjectRoutes';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EntityGraphView } from './components/EntityGraphView';
import {
  EntityRecord,
  EntitySummary,
  EntitySnapshot
} from '@arch-register/api-types/entityContract';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { EntityContentView } from './EntityContentView';
import { EntityTimelineTab } from './EntityTimelineTab';
import { Title } from '../../components/Title';
import { RestoreSnapshotDialog } from './components/RestoreSnapshotDialog';

type TabId = 'overview' | 'topology' | 'graph' | 'relations' | 'changes' | 'timeline';

type Relation = {
  entityId: string;
  publicId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

type RefLookup = Map<string, EntitySummary>;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const formatDateValue = (value: unknown) => {
  if (typeof value !== 'string' || value === '') return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export const EntityDetailScreen = () => {
  const navigate = useNavigate();
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string };
  const { workspaceSlug, schemas, lifecycleStates, teams, permissions } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const canViewAudit = permissions.canViewAudit;
  const contentFolder = search.contentFolder;

  const navigateToEntity = useCallback(
    (id: string) => {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(id)));
    },
    [navigate, workspaceSlug]
  );

  const navigateToEntities = useCallback(() => {
    navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } });
  }, [navigate, workspaceSlug]);
  const [tab, setTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<Record<string, unknown>>({});
  const [editLinks, setEditLinks] = useState<EntitySummary['_links']>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConfirmMessage, setSaveConfirmMessage] = useState('');
  const [saveConfirmSignificant, setSaveConfirmSignificant] = useState(false);
  const [pendingSaveBody, setPendingSaveBody] = useState<Record<string, unknown> | null>(null);

  // Query hooks
  const { data: entity, isLoading: loading } = useEntity(workspaceId, entityId);
  const auditEntityId = entity?._uid ?? null;
  const { data: relations = { outgoing: [], incoming: [] } } = useEntityRelations(
    workspaceId,
    entityId
  );
  const { data: auditLog = [], isLoading: loadingAudit } = useAuditLog(
    workspaceId,
    { entityId: auditEntityId, limit: 100 },
    { enabled: canViewAudit && tab === 'changes' && !!auditEntityId }
  );

  // Project association hooks
  const { data: entityProjects = [] } = useEntityProjects(workspaceId, entityId);
  const { data: entityDiagramFiles = [] } = useEntityDiagramFiles(workspaceId, entityId);

  // Mutation hooks
  const updateEntity = useUpdateEntity(workspaceId);
  const deleteEntity = useDeleteEntity(workspaceId);
  const cloneEntity = useCloneEntity(workspaceId);
  const promoteSnapshot = usePromoteSnapshot(workspaceId, entityId);
  const restoreSnapshot = useRestoreSnapshot(workspaceId, entityId);
  const { data: allSnapshots = [] } = useEntitySnapshots(workspaceId, entityId, true);
  const futureSnapshots = allSnapshots.filter(s => s.status === 'future_update');
  const createWatch = useCreateWatch(workspaceId);
  const deleteWatch = useDeleteWatch(workspaceId);
  const createPinnedEntity = useCreatePinnedEntity(workspaceId);
  const deletePinnedEntity = useDeletePinnedEntity(workspaceId);
  const { data: watchedEntities = [] } = useWatchedEntities(workspaceId);
  const { data: pinnedEntities = [] } = usePinnedEntities(workspaceId);

  const schemaEntry = useMemo(() => {
    if (!entity) return null;
    let idx = 0;
    for (const s of schemas) {
      if (s.id === entity._schema.id) return { schema: s, index: idx };
      idx++;
    }
    return null;
  }, [entity, schemas]);
  const isWatched = watchedEntities.some(item => item.entity_public_id === entityId);
  const isPinned = pinnedEntities.some(item => item.entity_public_id === entityId);

  const schema = schemaEntry?.schema ?? null;
  const color = schemaEntry
    ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
    : 'var(--accent-fg)';

  // Get reference field schema IDs
  const referenceSchemaIds = useMemo(() => {
    if (!schema) return [];
    return [
      ...new Set(
        schema.fields
          .filter(
            (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
              field.type === 'reference' || field.type === 'containment'
          )
          .map(field => field.schemaId)
          .filter(Boolean)
      )
    ];
  }, [schema]);

  // Fetch entities for each reference schema
  const referenceQueries = useEntitiesBySchema(workspaceId, referenceSchemaIds);

  // Build reference options from queries
  const referenceOptions = useMemo(() => {
    const options: Record<string, EntitySummary[]> = {};
    referenceSchemaIds.forEach((schemaId, index) => {
      const query = referenceQueries[index];
      if (query?.data) {
        options[schemaId] = query.data;
      }
    });
    return options;
  }, [referenceSchemaIds, referenceQueries]);

  // Build reference lookup from relations
  const refLookup = useMemo(() => {
    const lookup: RefLookup = new Map();
    relations.outgoing.forEach(relation => {
      lookup.set(relation.entityId, {
        _uid: relation.entityId,
        _publicId: relation.publicId,
        _schema: { id: relation.entitySchemaId, name: '' },
        _name: relation.entityName,
        _slug: relation.entitySlug,
        _namespace: '',
        _description: '',
        _owner: null,
        _lifecycle: null,
        _targetLifecycle: null,
        _targetLifecycleDate: null,
        _tags: [],
        _links: [],
        _visibilityMode: null,
        _completeness: null,
        canView: true,
        canEdit: false,
        canDelete: false,
        canAdmin: false,
        canCreateChild: false
      });
    });
    return lookup;
  }, [relations]);

  const outgoing: Relation[] = relations.outgoing;
  const incoming: Relation[] = relations.incoming;
  const relationCount = outgoing.length + incoming.length;

  const startEdit = () => {
    if (!entity || !schema) return;
    const state: Record<string, unknown> = {
      _name: entity._name ?? '',
      _slug: entity._slug ?? '',
      _description: entity._description ?? '',
      _owner: entity._owner?.id ?? '',
      _lifecycle: entity._lifecycle?.id ?? '',
      _targetLifecycle: entity._targetLifecycle?.id ?? '',
      _targetLifecycleDate: entity._targetLifecycleDate ?? '',
      _namespace: entity._namespace ?? '',
      _tags: (entity._tags ?? []).join(', ')
    };
    for (const f of schema.fields) {
      state[f.id] = entity[f.id] ?? '';
    }
    setEditState(state);
    setEditLinks(entity._links.map(l => ({ ...l })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState({});
    setEditLinks([]);
    setValidationErrors(new Set());
  };

  const saveEdit = async () => {
    if (!entity || !schema) return;

    const errors = new Set<string>();
    for (const f of schema.fields) {
      if (f.requirementLevel === 'required') {
        const val = editState[f.id];
        const isEmpty = val == null || (typeof val === 'string' && val.trim() === '');
        if (isEmpty) errors.add(f.id);
      }
    }
    if (errors.size > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors(new Set());

    const dataFields: Record<string, unknown> = {};
    for (const f of schema.fields) {
      dataFields[f.id] = editState[f.id] ?? '';
    }

    const tagsStr = (editState['_tags'] as string) ?? '';
    const tags = tagsStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const body = {
      _schemaId: entity._schema.id,
      _name: (editState['_name'] as string) ?? '',
      _slug: (editState['_slug'] as string) || entity._slug,
      _namespace: (editState['_namespace'] as string) || entity._namespace,
      _description: (editState['_description'] as string) ?? '',
      _owner: (editState['_owner'] as string) || null,
      _lifecycle: (editState['_lifecycle'] as string) || null,
      _targetLifecycle: (editState['_targetLifecycle'] as string) || null,
      _targetLifecycleDate: (editState['_targetLifecycleDate'] as string) || null,
      _tags: tags,
      _links: editLinks.filter(l => l.url.trim() !== ''),
      ...dataFields
    };

    setPendingSaveBody(body);
    setSaveConfirmMessage('');
    setSaveConfirmSignificant(false);
    setSaveConfirmOpen(true);
  };

  const executeSave = () => {
    if (!pendingSaveBody) return;
    setSaveConfirmOpen(false);
    updateEntity.mutate(
      { entityId, data: pendingSaveBody },
      {
        onSuccess: () => {
          if (saveConfirmSignificant) {
            promoteSnapshot.mutate({ commitMessage: saveConfirmMessage || undefined });
          }
          setEditing(false);
          setEditState({});
          setEditLinks([]);
          setPendingSaveBody(null);
        }
      }
    );
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    deleteEntity.mutate(entityId, {
      onSuccess: () => navigateToEntities()
    });
  };

  const handleClone = async () => {
    cloneEntity.mutate(entityId, {
      onSuccess: cloned => navigateToEntity(cloned._publicId)
    });
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!entity) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>Entity not found</div>
        <div>The entity may have been deleted.</div>
        <Button icon={<TbChevronLeft size={12} />} onClick={() => navigateToEntities()}>
          Back to entities
        </Button>
      </div>
    );
  }

  const entityName = entity._name || entity._slug;
  const menuItems: MenuItem[] = [
    ...(entity.canCreateChild
      ? [{ label: 'Clone', icon: <TbCopy size={14} />, onClick: handleClone }]
      : []),
    ...(entity.canDelete
      ? [{ label: 'Delete', icon: <TbTrash size={14} />, danger: true, onClick: handleDelete }]
      : [])
  ];

  return (
    <div className={`${styles.screen} ${tab === 'graph' ? styles.graphMode : ''}`}>
      {/* Header - hidden when viewing folder content */}
      {!contentFolder && (
        <div className={styles.head}>
          <Title
            breadcrumb={[
              {
                label: 'Home',
                onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
              },
              { label: 'Entities', onClick: () => navigateToEntities() }
            ]}
            icon={<TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={32} />}
            eyebrow={schema?.name ?? 'Entity'}
            title={entityName}
            chips={
              entity._lifecycle ? (
                <>
                  <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  {entity._targetLifecycle &&
                    entity._targetLifecycle.id !== entity._lifecycle.id && (
                      <>
                        <span>→</span>
                        <StatusChip
                          value={entity._targetLifecycle.id}
                          lifecycleStates={lifecycleStates}
                        />
                      </>
                    )}
                </>
              ) : undefined
            }
            description={entity._description}
            toggleButtons={
              !editing ? (
                <>
                  <button
                    type="button"
                    className={`${styles.watchBtn} ${isWatched ? styles.watchBtnActive : ''}`}
                    onClick={() =>
                      isWatched
                        ? deleteWatch.mutate(entity?._uid ?? entityId)
                        : createWatch.mutate(entity?._uid ?? entityId)
                    }
                    disabled={createWatch.isPending || deleteWatch.isPending}
                    title={isWatched ? 'Unwatch entity' : 'Watch entity'}
                    aria-label={isWatched ? 'Unwatch entity' : 'Watch entity'}
                  >
                    <TbBell size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.watchBtn} ${isPinned ? styles.watchBtnActive : ''}`}
                    onClick={() =>
                      isPinned
                        ? deletePinnedEntity.mutate(entity?._uid ?? entityId)
                        : createPinnedEntity.mutate({
                            entityId: entity?._uid ?? entityId,
                            entityPublicId: entity?._publicId ?? entityId,
                            entityName: entity._name || entity._slug,
                            entitySlug: entity._slug,
                            schemaId: entity._schema.id
                          })
                    }
                    disabled={createPinnedEntity.isPending || deletePinnedEntity.isPending}
                    title={isPinned ? 'Unpin entity' : 'Pin entity'}
                    aria-label={isPinned ? 'Unpin entity' : 'Pin entity'}
                  >
                    <TbPinned size={16} />
                  </button>
                </>
              ) : undefined
            }
            buttons={
              !editing ? (
                entity.canEdit ? (
                  <Button icon={<TbEdit size={12} />} onClick={startEdit}>
                    Edit
                  </Button>
                ) : undefined
              ) : (
                <>
                  {entity.canDelete && (
                    <Button variant="danger" icon={<TbTrash size={12} />} onClick={handleDelete}>
                      Delete
                    </Button>
                  )}
                  <Button onClick={cancelEdit}>Cancel</Button>
                  <Button
                    variant="primary"
                    onClick={saveEdit}
                    disabled={updateEntity.isPending || saveConfirmOpen}
                  >
                    {updateEntity.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )
            }
            menu={
              menuItems.length > 0 ? (
                <DropdownMenu
                  trigger={
                    <button type="button" className={styles.iconBtn}>
                      <TbDots size={14} />
                    </button>
                  }
                  items={menuItems}
                />
              ) : undefined
            }
          />
        </div>
      )}

      {/* Tabs */}
      {!contentFolder && (
        <div className={styles.tabBar}>
          <Tabs.Root value={tab} onValueChange={value => setTab(value as TabId)}>
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="topology">Topology</Tabs.Trigger>
              <Tabs.Trigger value="graph">Graph</Tabs.Trigger>
              <Tabs.Trigger value="relations">
                Relationships{relationCount > 0 ? ` (${relationCount})` : ''}
              </Tabs.Trigger>
              {canViewAudit && <Tabs.Trigger value="changes">Change history</Tabs.Trigger>}
              <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </div>
      )}

      {/* Content folder view */}
      {contentFolder && (
        <EntityContentView
          workspaceSlug={workspaceSlug}
          entityId={entityId}
          folder={contentFolder}
        />
      )}

      {/* Overview */}
      {!contentFolder && tab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.propsPanel}>
            {schema && schema.fields.length > 0 && (
              <>
                <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
                  Properties
                </div>
                <div className={styles.propList}>
                  {schema.fields.map(f => (
                    <PropertyRow
                      key={f.id}
                      field={f}
                      value={entity[f.id]}
                      editing={editing}
                      editValue={editState[f.id]}
                      onChange={v => {
                        setEditState(s => ({ ...s, [f.id]: v }));
                        if (validationErrors.has(f.id))
                          setValidationErrors(s => {
                            const n = new Set(s);
                            n.delete(f.id);
                            return n;
                          });
                      }}
                      refLookup={refLookup}
                      referenceOptions={referenceOptions}
                      onEntityClick={navigateToEntity}
                      hasError={validationErrors.has(f.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
              Metadata
            </div>
            {schema && <MetaPropRow label="Schema" value={schema.name} />}
            <MetaPropRow label="Public ID" value={entity._publicId} />
            <MetaPropRow label="Namespace" value={entity._namespace} />

            <hr className={styles.divider} />

            <MetaPropRow
              label="Name"
              value={entity._name || '—'}
              editing={editing}
              editValue={editState['_name'] as string}
              onChange={v => setEditState(s => ({ ...s, _name: v, _slug: slugify(v) }))}
            />
            <MetaPropRow
              label="Slug"
              value={entity._slug}
              editing={editing}
              editValue={editState['_slug'] as string}
              onChange={v => setEditState(s => ({ ...s, _slug: v }))}
            />
            {(entity._description || editing) && (
              <div className={styles.metaPropRow}>
                <span className={styles.metaPropLabel}>Description</span>
                <span className={styles.metaPropValue}>
                  {editing ? (
                    <textarea
                      className={styles.textareaInline}
                      value={editState['_description'] as string}
                      onChange={e => setEditState(s => ({ ...s, _description: e.target.value }))}
                    />
                  ) : (
                    entity._description
                  )}
                </span>
              </div>
            )}
            <MetaPropRow
              label="Owner"
              value={entity._owner?.name ?? '—'}
              editing={editing}
              editValue={editState['_owner'] as string}
              onChange={v => setEditState(s => ({ ...s, _owner: v }))}
              selectOptions={[
                { value: '', label: '—' },
                ...teams.map(team => ({ value: team.id, label: team.name }))
              ]}
            />
            <MetaPropRow
              label="Lifecycle"
              value={entity._lifecycle?.name ?? '—'}
              editing={editing}
              editValue={editState['_lifecycle'] as string}
              onChange={v => setEditState(s => ({ ...s, _lifecycle: v }))}
              selectOptions={[
                { value: '', label: '—' },
                ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
              ]}
            />
            <MetaPropRow
              label="Target Lifecycle"
              value={entity._targetLifecycle?.name ?? '—'}
              editing={editing}
              editValue={editState['_targetLifecycle'] as string}
              onChange={v => setEditState(s => ({ ...s, _targetLifecycle: v }))}
              selectOptions={[
                { value: '', label: '—' },
                ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
              ]}
            />
            <MetaPropRow
              label="Target Date"
              value={entity._targetLifecycleDate ?? '—'}
              editing={editing}
              editValue={editState['_targetLifecycleDate'] as string}
              onChange={v => setEditState(s => ({ ...s, _targetLifecycleDate: v }))}
              type="date"
            />
            {(entity._tags.length > 0 || editing) && (
              <div className={styles.metaPropRow}>
                <span className={styles.metaPropLabel}>Tags</span>
                <span className={styles.metaPropValue}>
                  {editing ? (
                    <input
                      className={styles.inputInline}
                      value={editState['_tags'] as string}
                      onChange={e => setEditState(s => ({ ...s, _tags: e.target.value }))}
                      placeholder="comma-separated"
                    />
                  ) : (
                    <span className={styles.tags}>
                      {entity._tags.map(t => (
                        <Chip key={t} tone="ghost">
                          {t}
                        </Chip>
                      ))}
                    </span>
                  )}
                </span>
              </div>
            )}
            {editing ? (
              <div className={styles.linksEdit}>
                <div className={styles.metaPropLabel}>Links</div>
                {editLinks.map((l, i) => (
                  <div key={i} className={styles.linkRow}>
                    <input
                      className={styles.inputInline}
                      value={l.type ?? ''}
                      onChange={e =>
                        setEditLinks(ls =>
                          ls.map((x, j) => (j === i ? { ...x, type: e.target.value } : x))
                        )
                      }
                      placeholder="Type"
                      style={{ width: 70, flex: 'none' }}
                    />
                    <input
                      className={styles.inputInline}
                      value={l.title}
                      onChange={e =>
                        setEditLinks(ls =>
                          ls.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                        )
                      }
                      placeholder="Title"
                    />
                    <input
                      className={styles.inputInline}
                      value={l.url}
                      onChange={e =>
                        setEditLinks(ls =>
                          ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                        )
                      }
                      placeholder="URL"
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setEditLinks(ls => ls.filter((_, j) => j !== i))}
                    >
                      <TbX size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addLinkBtn}
                  onClick={() => setEditLinks(ls => [...ls, { url: '', title: '', type: '' }])}
                >
                  <TbPlus size={11} /> Add link
                </button>
              </div>
            ) : (
              entity._links.length > 0 &&
              entity._links.map((l, i) => (
                <div key={i} className={styles.metaPropRow}>
                  <span className={styles.metaPropLabel}>
                    {l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : 'Link'}
                  </span>
                  <span className={styles.metaPropValue}>
                    <a
                      className={styles.propLink}
                      href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <TbExternalLink size={11} /> {l.title || l.url}
                    </a>
                  </span>
                </div>
              ))
            )}

            <hr className={styles.divider} />

            <div className={styles.sectionLabel}>Projects</div>
            {entityProjects.length === 0 ? (
              <div className={styles.metaPropRow}>
                <span className={styles.metaPropValue} style={{ color: 'var(--base-fg-more-dim)' }}>
                  Not in any project
                </span>
              </div>
            ) : (
              entityProjects.map(({ project, entity_type }) => (
                <div key={project.id} className={styles.metaPropRow}>
                  <span className={styles.metaPropLabel}>{project.name}</span>
                  <span className={styles.metaPropValue}>
                    {entity_type ? (
                      entity_type.name
                    ) : (
                      <span style={{ color: 'var(--base-fg-more-dim)' }}>—</span>
                    )}
                  </span>
                </div>
              ))
            )}

            {futureSnapshots.length > 0 && (
              <>
                <hr className={styles.divider} />
                <div className={styles.sectionLabel}>Future plans</div>
                {futureSnapshots.map(snap => {
                  const projectName =
                    entityProjects.find(ep => ep.project.id === snap.project_id)?.project.name ??
                    snap.project_id;
                  return (
                    <div key={snap.id} className={styles.futurePlan}>
                      <div className={styles.futurePlanMeta}>
                        <span className={styles.futurePlanProject}>{projectName}</span>
                        {snap.target_date && (
                          <span className={styles.futurePlanDate}>
                            {new Date(`${snap.target_date}T00:00:00`).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {snap.commit_message && (
                        <div className={styles.futurePlanNote}>{snap.commit_message}</div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <hr className={styles.divider} />

            <div className={styles.sectionLabel}>Diagrams</div>
            {entityDiagramFiles.length === 0 ? (
              <div className={styles.metaPropRow}>
                <span className={styles.metaPropValue} style={{ color: 'var(--base-fg-more-dim)' }}>
                  Not in any diagram
                </span>
              </div>
            ) : (
              <div className={styles.miniDiagramList}>
                {entityDiagramFiles.map(({ file, project }) => (
                  <a
                    key={file.id}
                    className={styles.miniDiagramRow}
                    href={projectDiagramHref(
                      workspaceSlug,
                      asProjectPublicId(project.public_id),
                      file.id
                    )}
                  >
                    <div className={styles.miniDiagramThumb}>
                      <div className={styles.miniDiagramThumbGrid} />
                      {file.preview_svg ? (
                        <div
                          className={styles.miniDiagramThumbPreview}
                          dangerouslySetInnerHTML={{ __html: file.preview_svg }}
                        />
                      ) : (
                        <svg
                          className={styles.miniDiagramThumbSvg}
                          viewBox="0 0 60 30"
                          preserveAspectRatio="none"
                        >
                          <rect
                            x="3"
                            y="7"
                            width="12"
                            height="7"
                            rx="1"
                            fill="var(--cmp-bg)"
                            stroke="var(--base-fg-more-dim)"
                            strokeWidth="0.7"
                          />
                          <rect
                            x="23"
                            y="3"
                            width="12"
                            height="7"
                            rx="1"
                            fill="var(--cmp-bg)"
                            stroke="var(--base-fg-more-dim)"
                            strokeWidth="0.7"
                          />
                          <rect
                            x="23"
                            y="20"
                            width="12"
                            height="7"
                            rx="1"
                            fill="var(--cmp-bg)"
                            stroke="var(--base-fg-more-dim)"
                            strokeWidth="0.7"
                          />
                          <rect
                            x="43"
                            y="10"
                            width="12"
                            height="7"
                            rx="1"
                            fill="color-mix(in oklch, var(--tag-component) 28%, var(--cmp-bg))"
                            stroke="var(--tag-component)"
                            strokeWidth="0.7"
                          />
                          <path
                            d="M15 10 L23 6 M15 11 L23 23 M35 6 L43 14 M35 23 L43 14"
                            stroke="var(--cmp-fg-disabled)"
                            fill="none"
                            strokeWidth="0.7"
                          />
                        </svg>
                      )}
                    </div>
                    <div className={styles.miniDiagramBody}>
                      <div className={styles.miniDiagramName}>{file.name}</div>
                      <div className={styles.miniDiagramSub}>{project.name}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topology */}
      {!contentFolder && tab === 'topology' && (
        <TopologyView
          entity={entity}
          schema={schema}
          color={color}
          outgoing={outgoing}
          incoming={incoming}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={navigateToEntity}
        />
      )}

      {/* Graph */}
      {!contentFolder && tab === 'graph' && entity && (
        <div className={styles.graphPanel}>
          <EntityGraphView
            workspaceId={workspaceId}
            rootEntityId={entityId}
            rootEntityName={entity._name || entity._slug}
            rootEntitySchemaId={entity._schema.id}
            schemas={schemas}
            onEntityClick={navigateToEntity}
          />
        </div>
      )}

      {/* Relationships */}
      {!contentFolder && tab === 'relations' && (
        <div className={styles.relationsPage}>
          {relationCount === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No relationships</div>
              <div>Add reference or containment fields to connect entities.</div>
            </div>
          ) : (
            <>
              <div className={styles.sectionLabel}>Outgoing ({outgoing.length})</div>
              <div className={styles.relationsList}>
                {outgoing.map((r, i) => (
                  <RelationRow
                    key={`o-${i}`}
                    relation={r}
                    direction="outgoing"
                    schemas={schemas}
                    onEntityClick={navigateToEntity}
                  />
                ))}
                {outgoing.length === 0 && (
                  <div className={styles.dim} style={{ padding: 8 }}>
                    None
                  </div>
                )}
              </div>
              <div className={styles.sectionLabel}>Incoming ({incoming.length})</div>
              <div className={styles.relationsList}>
                {incoming.map((r, i) => (
                  <RelationRow
                    key={`i-${i}`}
                    relation={r}
                    direction="incoming"
                    schemas={schemas}
                    onEntityClick={navigateToEntity}
                  />
                ))}
                {incoming.length === 0 && (
                  <div className={styles.dim} style={{ padding: 8 }}>
                    None
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Change history */}
      {!contentFolder && tab === 'changes' && (
        <ChangeHistory
          auditLog={auditLog}
          loading={loadingAudit}
          snapshots={allSnapshots}
          onRestore={(snapshotId, commitMessage) =>
            restoreSnapshot.mutateAsync({ snapshotId, commitMessage })
          }
          isRestoring={restoreSnapshot.isPending}
          entity={entity}
          schema={schema}
          lifecycleStates={lifecycleStates}
          teams={teams}
        />
      )}

      {/* Timeline */}
      {!contentFolder && tab === 'timeline' && (
        <EntityTimelineTab
          allSnapshots={allSnapshots}
          entityProjects={entityProjects}
          schema={schema}
          lifecycleStates={lifecycleStates}
          teams={teams}
        />
      )}

      <Dialog
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="Save changes"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setSaveConfirmOpen(false) },
          {
            label: updateEntity.isPending ? 'Saving...' : 'Save',
            type: 'default',
            disabled: updateEntity.isPending,
            onClick: executeSave
          }
        ]}
      >
        <FormElement label="Note (optional)">
          <TextInput
            value={saveConfirmMessage}
            onChange={v => setSaveConfirmMessage(v ?? '')}
            placeholder="Describe what changed (optional)"
            style={{ width: '100%' }}
          />
        </FormElement>
        <FormElement label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={saveConfirmSignificant}
              onChange={e => setSaveConfirmSignificant(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Mark as significant version</span>
          </label>
        </FormElement>
      </Dialog>

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete entity?"
        message={
          <>
            The entity <b>{entityName}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete entity"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

const MetaPropRow = ({
  label,
  value,
  editing,
  editValue,
  onChange,
  selectOptions,
  type = 'text'
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  selectOptions?: Array<{ value: string; label: string }>;
  type?: 'text' | 'date';
}) => (
  <div className={styles.metaPropRow}>
    <span className={styles.metaPropLabel}>{label}</span>
    <span className={styles.metaPropValue}>
      {editing && onChange ? (
        selectOptions ? (
          <select
            className={styles.selectInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          >
            {selectOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : type === 'date' ? (
          <DateInput
            value={editValue ?? ''}
            onChange={v => onChange(v ?? '')}
            style={{ width: '100%' }}
          />
        ) : (
          <input
            className={styles.inputInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          />
        )
      ) : (
        value
      )}
    </span>
  </div>
);

const PropertyRow = ({
  field,
  value,
  editing,
  editValue,
  onChange,
  refLookup,
  referenceOptions,
  onEntityClick,
  hasError
}: {
  field: EntitySchema['fields'][number];
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onChange: (v: unknown) => void;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  onEntityClick: (entityId: string) => void;
  hasError?: boolean;
}) => {
  const renderEditor = () => {
    if (field.type === 'reference' || field.type === 'containment') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      return (
        <select
          className={styles.selectInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {candidates.map(e => (
            <option key={e._uid} value={e._uid}>
              {e._name || e._slug}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'select') {
      return (
        <select
          className={styles.selectInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {field.options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'longtext') {
      return (
        <textarea
          className={styles.textareaInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <input type="checkbox" checked={!!editValue} onChange={e => onChange(e.target.checked)} />
      );
    }
    if (field.type === 'date') {
      return (
        <input
          className={styles.inputInline}
          type="date"
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    return (
      <input
        className={styles.inputInline}
        value={(editValue as string) ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    );
  };

  const renderDisplay = () => {
    if (value == null || value === '') return <span className={styles.dim}>—</span>;
    if (field.type === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
    if (field.type === 'select') {
      const opt = field.options.find(o => o.value === value);
      return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
    }
    if (field.type === 'reference' || field.type === 'containment') {
      const ids = String(value)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (ids.length === 0) return <span className={styles.dim}>—</span>;
      return (
        <>
          {ids.map(id => {
            const ref = refLookup.get(id);
            const label = ref?._name ?? ref?._slug ?? id;
            return (
              <button
                key={id}
                type="button"
                className={styles.propLink}
                onClick={() => onEntityClick(ref?._publicId ?? id)}
              >
                {label}
              </button>
            );
          })}
        </>
      );
    }
    if (field.type === 'date') return <span>{formatDateValue(value)}</span>;
    return <span>{String(value)}</span>;
  };

  const typeLabel = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  return (
    <div className={`${styles.propRow} ${hasError ? styles.propRowError : ''}`}>
      <div className={styles.propLabel}>
        {field.name}
        <span className={styles.propType}>{typeLabel}</span>
        {field.requirementLevel === 'required' && <span className={styles.propReq}>Required</span>}
        {field.requirementLevel === 'expected' && (
          <span className={styles.propExpected}>Expected</span>
        )}
      </div>
      <div
        className={styles.propValue}
        style={hasError ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}
      >
        {editing ? renderEditor() : renderDisplay()}
        {hasError && <span className={styles.propErrorMsg}>This field is required</span>}
      </div>
    </div>
  );
};

const RelationRow = ({
  relation,
  direction,
  schemas,
  onEntityClick
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  schemas: EntitySchema[];
  onEntityClick: (entityId: string) => void;
}) => {
  const targetSchemaId =
    direction === 'outgoing' ? relation.entitySchemaId : relation.entitySchemaId;
  const schemaIdx = schemas.findIndex(s => s.id === targetSchemaId);
  const targetSchema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const targetColor = targetSchema
    ? resolveSchemaColor(targetSchema, schemaIdx)
    : 'var(--accent-fg)';

  return (
    <button
      type="button"
      className={styles.relation}
      onClick={() => onEntityClick(relation.publicId)}
    >
      <Chip tone="ghost">{relation.fieldName}</Chip>
      <TbChevronRight size={10} className={styles.dim} />
      <TypeBadge
        color={targetColor}
        name={targetSchema?.name}
        icon={targetSchema?.icon}
        size={16}
      />
      <span className={styles.relationName}>{relation.entityName}</span>
      <span className={styles.dim}>{relation.entitySlug}</span>
    </button>
  );
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const formatValue = (val: unknown) => {
  if (val == null || val === '') return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const getOperationLabel = (op: string) => {
  switch (op) {
    case 'create':
      return 'created entity';
    case 'update':
      return 'updated';
    case 'delete':
      return 'deleted entity';
    default:
      return op;
  }
};

type ChangeRowData = {
  when: string;
  who: string;
  what: string;
  from: string;
  to: string;
};

const flattenAuditEntries = (entries: AuditLogEntry[]): ChangeRowData[] => {
  const rows: ChangeRowData[] = [];
  for (const entry of entries) {
    const when = formatTimestamp(entry.timestamp);
    const who = entry.user_display_name ?? entry.user_id ?? 'Unknown';

    if (entry.operation === 'create') {
      rows.push({ when, who, what: 'created entity', from: '—', to: '—' });
      continue;
    }

    if (entry.operation === 'delete') {
      rows.push({ when, who, what: 'deleted entity', from: '—', to: '—' });
      continue;
    }

    const oldData = entry.changes.old ?? {};
    const newData = entry.changes.new ?? {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    let hasChanges = false;

    allKeys.forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        hasChanges = true;
        const label = key.startsWith('_') ? key.slice(1) : key;
        rows.push({
          when,
          who,
          what: `changed ${label}`,
          from: formatValue(oldData[key]),
          to: formatValue(newData[key])
        });
      }
    });

    if (!hasChanges) {
      rows.push({ when, who, what: getOperationLabel(entry.operation), from: '—', to: '—' });
    }
  }
  return rows;
};

const ChangeRow = ({ row }: { row: ChangeRowData }) => (
  <tr>
    <td className={styles.chDim}>{row.when}</td>
    <td>{row.who}</td>
    <td className={styles.chDim}>{row.what}</td>
    <td className={styles.chMono}>{row.from}</td>
    <td className={styles.chMono}>{row.to}</td>
  </tr>
);

const ChangeHistory = ({
  auditLog,
  loading,
  snapshots,
  onRestore,
  isRestoring,
  entity,
  schema,
  lifecycleStates,
  teams
}: {
  auditLog: AuditLogEntry[];
  loading: boolean;
  snapshots: EntitySnapshot[];
  onRestore: (snapshotId: string, commitMessage?: string) => Promise<unknown>;
  isRestoring: boolean;
  entity: EntityRecord | null;
  schema: EntitySchema | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [restoreDialogSnapshot, setRestoreDialogSnapshot] = useState<EntitySnapshot | null>(null);

  const savedSnapshots = useMemo(
    () =>
      snapshots.filter(
        s => s.status === 'autosave' || s.status === 'saved_version' || s.status === 'applied'
      ),
    [snapshots]
  );

  const handleRestore = async (commitMessage?: string) => {
    if (restoreDialogSnapshot) {
      try {
        await onRestore(restoreDialogSnapshot.id, commitMessage);
        setRestoreDialogSnapshot(null);
      } catch {
        // keep dialog open so the user can retry
      }
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading change history...</div>;
  }

  if (auditLog.length === 0 && savedSnapshots.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No change history yet</div>
        <div>Changes will appear here as properties are edited.</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.changeHistory}>
        {savedSnapshots.length > 0 && (
          <div>
            <div className={styles.chTableWrap}>
              <table className={styles.chTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>By</th>
                    <th>Message</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {savedSnapshots.map(snapshot => (
                    <tr key={snapshot.id}>
                      <td className={styles.chDim}>
                        {new Date(snapshot.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>
                        <span
                          className={`${styles.snapshotTypeBadge} ${snapshot.status !== 'autosave' ? styles.snapshotTypeBadgeSaved : ''}`}
                        >
                          {snapshot.status === 'saved_version'
                            ? 'saved'
                            : snapshot.status === 'applied'
                              ? 'applied'
                              : 'autosave'}
                        </span>
                      </td>
                      <td>{snapshot.created_by_name ?? '—'}</td>
                      <td className={styles.chDim}>{snapshot.commit_message ?? '—'}</td>
                      <td className={styles.chActionsCell}>
                        {snapshot.status !== 'future_update' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRestoreDialogSnapshot(snapshot)}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {restoreDialogSnapshot && entity && (
        <RestoreSnapshotDialog
          isOpen={true}
          onClose={() => setRestoreDialogSnapshot(null)}
          onConfirm={handleRestore}
          snapshot={restoreDialogSnapshot}
          currentState={{
            name: entity._name,
            description: entity._description,
            lifecycle: entity._lifecycle?.id ?? null,
            target_lifecycle: entity._targetLifecycle?.id ?? null,
            target_lifecycle_date: entity._targetLifecycleDate,
            owner: entity._owner?.id ?? null,
            data: schema ? Object.fromEntries(schema.fields.map(f => [f.id, entity[f.id]])) : {}
          }}
          schema={schema}
          lifecycleStates={lifecycleStates}
          teams={teams}
          isRestoring={isRestoring}
        />
      )}
    </>
  );
};

// =========================================================
// Topology View
// =========================================================

type EdgePath = {
  key: string;
  d: string;
};

type TopologyViewProps = {
  entity: EntityRecord;
  schema: EntitySchema | null;
  color: string;
  outgoing: Relation[];
  incoming: Relation[];
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (entityId: string) => void;
};

const groupByField = (rels: Relation[]): [string, Relation[]][] => {
  const groups = new Map<string, Relation[]>();
  for (const r of rels) {
    const list = groups.get(r.fieldName);
    if (list) list.push(r);
    else groups.set(r.fieldName, [r]);
  }
  return [...groups.entries()];
};

const TopologyView = ({
  entity,
  schema,
  color,
  outgoing,
  incoming,
  schemas,
  lifecycleStates,
  onEntityClick
}: TopologyViewProps) => {
  const parents = useMemo(() => outgoing.filter(r => r.kind === 'containment'), [outgoing]);
  const children = useMemo(() => incoming.filter(r => r.kind === 'containment'), [incoming]);
  const consumesRefs = useMemo(() => outgoing.filter(r => r.kind === 'reference'), [outgoing]);
  const usedByRefs = useMemo(() => incoming.filter(r => r.kind === 'reference'), [incoming]);

  const containerRef = useRef<HTMLDivElement>(null);
  const entityBoxRef = useRef<HTMLDivElement>(null);
  const refCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [edges, setEdges] = useState<EdgePath[]>([]);
  const topologyVersion = `${parents.length}:${children.length}:${consumesRefs.length}:${usedByRefs.length}`;

  const resolveRelColor = useCallback(
    (rel: Relation) => {
      const idx = schemas.findIndex(s => s.id === rel.entitySchemaId);
      const s = idx >= 0 ? schemas[idx] : null;
      return { schema: s, color: s ? resolveSchemaColor(s, idx) : 'var(--accent-fg)' };
    },
    [schemas]
  );

  const setCardRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) refCardRefs.current.set(key, el);
      else refCardRefs.current.delete(key);
    },
    []
  );

  useLayoutEffect(() => {
    void topologyVersion;
    const container = containerRef.current;
    const entityBox = entityBoxRef.current;
    if (!container || !entityBox) {
      setEdges([]);
      return;
    }

    const compute = () => {
      if (!containerRef.current || !entityBoxRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const eRect = entityBoxRef.current.getBoundingClientRect();
      const next: EdgePath[] = [];

      const entityBottom = eRect.bottom - cRect.top;

      // Compute trunk X for each side based on actual card positions
      let inMaxRight = -Infinity;
      let outMinLeft = Infinity;

      refCardRefs.current.forEach((el, key) => {
        const r = el.getBoundingClientRect();
        if (key.startsWith('in-')) inMaxRight = Math.max(inMaxRight, r.right - cRect.left);
        else outMinLeft = Math.min(outMinLeft, r.left - cRect.left);
      });

      const inTrunkX =
        inMaxRight !== -Infinity ? inMaxRight + 28 : eRect.left - cRect.left + eRect.width * 0.35;
      const outTrunkX =
        outMinLeft !== Infinity ? outMinLeft - 28 : eRect.left - cRect.left + eRect.width * 0.65;

      refCardRefs.current.forEach((el, key) => {
        const r = el.getBoundingClientRect();
        const cardMidY = r.top - cRect.top + r.height / 2;

        if (key.startsWith('out-')) {
          // Consumes: down from entity, right to card
          const cardLeft = r.left - cRect.left - 4;
          const d =
            `M ${outTrunkX} ${entityBottom} L ${outTrunkX} ${cardMidY} L ${cardLeft} ${cardMidY}` +
            ` M ${cardLeft - 4} ${cardMidY - 4} L ${cardLeft} ${cardMidY} L ${cardLeft - 4} ${cardMidY + 4}`;
          next.push({ key, d });
        } else {
          // Used by: from card right, up to entity
          const cardRight = r.right - cRect.left + 4;
          const d =
            `M ${cardRight} ${cardMidY} L ${inTrunkX} ${cardMidY} L ${inTrunkX} ${entityBottom}` +
            ` M ${inTrunkX - 4} ${entityBottom + 4} L ${inTrunkX} ${entityBottom} L ${inTrunkX + 4} ${entityBottom + 4}`;
          next.push({ key, d });
        }
      });

      setEdges(next);
    };

    let raf: number;
    const debouncedCompute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    debouncedCompute();
    const observer = new ResizeObserver(debouncedCompute);
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [topologyVersion]);

  const isEmpty = parents.length + children.length + consumesRefs.length + usedByRefs.length === 0;

  return (
    <div className={styles.topologyPage} ref={containerRef}>
      <svg className={styles.topoEdgeSvg}>
        {edges.map(edge => (
          <path
            key={edge.key}
            d={edge.d}
            stroke="var(--base-fg-more-dim)"
            strokeWidth={1.2}
            fill="none"
            opacity={0.7}
          />
        ))}
      </svg>

      {parents.length > 0 && (
        <div className={styles.topoParents}>
          <div className={styles.topoParentsItems}>
            {parents.map((p, i) => {
              const { schema: ps, color: pc } = resolveRelColor(p);
              return (
                <button
                  key={i}
                  type="button"
                  className={styles.topoParentChip}
                  onClick={() => onEntityClick(p.publicId)}
                >
                  <TypeBadge color={pc} name={ps?.name} icon={ps?.icon} size={14} />
                  <span className={styles.topoParentName}>{p.entityName}</span>
                  <span className={styles.dim}>part of</span>
                </button>
              );
            })}
          </div>
          <svg width="12" height="18" viewBox="0 0 12 18" className={styles.topoParentArrow}>
            <path
              d="M 6 0 L 6 14 M 2 10 L 6 14 L 10 10"
              stroke="var(--base-fg-more-dim)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>
      )}

      <div className={styles.topoEntityBox} ref={entityBoxRef}>
        <div className={styles.topoEntityAccent} />
        <div className={styles.topoEntityHead}>
          <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={28} />
          <div className={styles.topoEntityMeta}>
            <div className={styles.topoEntityEyebrow}>{schema?.name ?? 'Entity'}</div>
            <div className={styles.topoEntityName}>{entity._name || entity._slug}</div>
          </div>
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </div>

        {children.length > 0 ? (
          <>
            <div className={styles.topoEntitySection}>
              <span>Contains</span>
              <span className={styles.dim}>({children.length})</span>
            </div>
            <div className={styles.topoChildrenGrid}>
              {children.map((c, i) => {
                const { schema: cs, color: cc } = resolveRelColor(c);
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.topoChildCard}
                    onClick={() => onEntityClick(c.publicId)}
                  >
                    <span className={styles.topoCardBar} style={{ background: cc }} />
                    <div className={styles.topoChildHead}>
                      <TypeBadge color={cc} name={cs?.name} icon={cs?.icon} size={14} />
                      <span className={styles.topoCardName}>{c.entityName}</span>
                    </div>
                    <div className={styles.topoChildMeta}>
                      {cs && <Chip tone="ghost">{cs.name}</Chip>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          !isEmpty && (
            <div className={`${styles.topoEntityEmpty} ${styles.dim}`}>No contained entities</div>
          )
        )}
      </div>

      {(usedByRefs.length > 0 || consumesRefs.length > 0) && (
        <div className={styles.topoRefsGrid}>
          <div className={`${styles.topoRefsCol} ${styles.topoRefsColIn}`}>
            {usedByRefs.length === 0 && (
              <div className={`${styles.topoRefsEmpty} ${styles.dim}`}>No incoming references</div>
            )}
            {groupByField(usedByRefs).map(([fieldName, rels]) => (
              <div key={fieldName} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>
                  {fieldName} ({rels.length})
                </div>
                {rels.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`in-${fieldName}-${i}`) as React.Ref<HTMLButtonElement>}
                      className={styles.topoRefCard}
                      onClick={() => onEntityClick(r.publicId)}
                    >
                      <span className={styles.topoCardBar} style={{ background: rc }} />
                      <TypeBadge color={rc} name={rs?.name} icon={rs?.icon} size={14} />
                      <div className={styles.topoRefBody}>
                        <div className={styles.topoCardName}>{r.entityName}</div>
                        {rs && (
                          <div className={`${styles.topoRefKind} ${styles.dim}`}>{rs.name}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className={`${styles.topoRefsCol} ${styles.topoRefsColOut}`}>
            {consumesRefs.length === 0 && (
              <div className={`${styles.topoRefsEmpty} ${styles.dim}`}>No outgoing references</div>
            )}
            {groupByField(consumesRefs).map(([fieldName, rels]) => (
              <div key={fieldName} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>
                  {fieldName} ({rels.length})
                </div>
                {rels.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`out-${fieldName}-${i}`) as React.Ref<HTMLButtonElement>}
                      className={styles.topoRefCard}
                      onClick={() => onEntityClick(r.publicId)}
                    >
                      <span className={styles.topoCardBar} style={{ background: rc }} />
                      <TypeBadge color={rc} name={rs?.name} icon={rs?.icon} size={14} />
                      <div className={styles.topoRefBody}>
                        <div className={styles.topoCardName}>{r.entityName}</div>
                        {rs && (
                          <div className={`${styles.topoRefKind} ${styles.dim}`}>{rs.name}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No relationships defined</div>
          <div>Add reference or containment fields to see the topology.</div>
        </div>
      )}
    </div>
  );
};
