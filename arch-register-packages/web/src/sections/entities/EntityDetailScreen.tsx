import { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './EntityDetailScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import { Chip } from '../../components/Chip';
import { TbChevronLeft, TbEdit, TbDots, TbTrash, TbCopy, TbBell, TbPinned } from 'react-icons/tb';
import { getRelationDisplayLabel } from '../../lib/entityRelations';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import {
  useEntity,
  useEntityRelations,
  useUpdateEntity,
  useDeleteEntity,
  useCloneEntity,
  useEntitiesBySchema
} from '../../hooks/useEntities';
import { useEntitySnapshots, usePromoteSnapshot } from '../../hooks/useSnapshots';
import { useEntityDiagramFiles, useEntityProjects } from '../../hooks/useProjects';
import {
  useCreatePinnedEntity,
  useCreateWatch,
  useDeletePinnedEntity,
  useDeleteWatch,
  usePinnedEntities,
  useWatchedEntities
} from '../../hooks/useNotifications';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EntityGraphView } from './components/EntityGraphView';
import { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntityContentView } from './EntityContentView';
import { EntityOverviewTab } from './components/EntityOverviewTab';
import { EntityRelationsTab } from './components/EntityRelationsTab';
import { EntityTimelineTab } from './components/EntityTimelineTab';
import { EntityChangeHistoryTab } from './components/EntityChangeHistoryTab';
import { Title } from '../../components/Title';
import { EntityDependentsTab } from './components/EntityDependentsTab';
import { EntityAssessmentsTab } from './components/EntityAssessmentsTab';
import { DiscussionThread } from '../discussions/DiscussionThread';
import { createEntityEditState, createEntityUpdateBody, requiredEntityFieldIds } from './entityDetailEditState';

type TabId =
  | 'overview'
  | 'topology'
  | 'graph'
  | 'relations'
  | 'dependents'
  | 'assessments'
  | 'discussions'
  | 'changes'
  | 'timeline';

export type Relation = {
  entityId: string;
  publicId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  fieldPredicate?: string;
  kind: 'reference' | 'containment';
};

export type RelationGroup = {
  key: string;
  label: string;
  relations: Relation[];
};

export type RefLookup = Map<string, EntitySummary>;

export const EntityDetailScreen = () => {
  const navigate = useNavigate();
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string; tab?: TabId };
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
  const tab = search.tab ?? 'overview';
  const setTab = useCallback(
    (nextTab: TabId) => {
      navigate({
        search: ((previous: Record<string, unknown>) => ({
          ...previous,
          tab: nextTab === 'overview' ? undefined : nextTab
        })) as never
      });
    },
    [navigate]
  );
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
  const { data: relations = { outgoing: [], incoming: [] } } = useEntityRelations(
    workspaceId,
    entityId
  );

  // Project association hooks
  const { data: entityProjects = [] } = useEntityProjects(workspaceId, entityId);
  const { data: entityDiagramFiles = [] } = useEntityDiagramFiles(workspaceId, entityId);

  // Mutation hooks
  const updateEntity = useUpdateEntity(workspaceId);
  const deleteEntity = useDeleteEntity(workspaceId);
  const cloneEntity = useCloneEntity(workspaceId);
  const promoteSnapshot = usePromoteSnapshot(workspaceId, entityId);
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
    setEditState(createEntityEditState(entity, schema));
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

    const errors = requiredEntityFieldIds(editState, schema);
    if (errors.size > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors(new Set());

    const body = createEntityUpdateBody(entity, schema, editState, editLinks);

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
              <Tabs.Trigger value="dependents">
                Dependents{incoming.length > 0 ? ` (${incoming.length})` : ''}
              </Tabs.Trigger>
              <Tabs.Trigger value="assessments">Assessments</Tabs.Trigger>
              <Tabs.Trigger value="discussions">Discussions</Tabs.Trigger>
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
        <EntityOverviewTab
          workspaceSlug={workspaceSlug}
          entity={entity}
          schema={schema}
          editing={editing}
          editState={editState}
          setEditState={setEditState}
          editLinks={editLinks}
          setEditLinks={setEditLinks}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          refLookup={refLookup}
          referenceOptions={referenceOptions}
          onEntityClick={navigateToEntity}
          teams={teams}
          lifecycleStates={lifecycleStates}
          entityProjects={entityProjects}
          futureSnapshots={futureSnapshots}
          entityDiagramFiles={entityDiagramFiles}
        />
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
            rootEntityId={entity._uid}
            rootEntityName={entity._name || entity._slug}
            rootEntitySchemaId={entity._schema.id}
            schemas={schemas}
            onEntityClick={navigateToEntity}
          />
        </div>
      )}

      {/* Relationships */}
      {!contentFolder && tab === 'relations' && (
        <EntityRelationsTab
          outgoing={outgoing}
          incoming={incoming}
          schemas={schemas}
          onEntityClick={navigateToEntity}
        />
      )}

      {/* Dependents (impact analysis) */}
      {!contentFolder && tab === 'dependents' && (
        <EntityDependentsTab
          workspaceId={workspaceId}
          entityId={entityId}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={navigateToEntity}
        />
      )}

      {/* Assessments */}
      {!contentFolder && tab === 'assessments' && (
        <EntityAssessmentsTab workspaceId={workspaceId} entity={entity} schema={schema} />
      )}

      {/* Discussions */}
      {!contentFolder && tab === 'discussions' && (
        <div className={styles.tabPane}>
          <DiscussionThread workspaceId={workspaceId} objectType="entity" objectId={entity._uid} />
        </div>
      )}

      {/* Change history */}
      {!contentFolder && tab === 'changes' && (
        <EntityChangeHistoryTab
          workspaceId={workspaceId}
          entityId={entityId}
          entity={entity}
          schema={schema}
          snapshots={allSnapshots}
          lifecycleStates={lifecycleStates}
          teams={teams}
          canViewAudit={canViewAudit}
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

const groupByField = (rels: Relation[]): RelationGroup[] => {
  const groups = new Map<string, RelationGroup>();
  for (const r of rels) {
    const key = r.fieldName;
    const group = groups.get(key);
    if (group) {
      group.relations.push(r);
    } else {
      groups.set(key, {
        key,
        label: getRelationDisplayLabel(r),
        relations: [r]
      });
    }
  }
  return [...groups.values()];
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
                </button>
              );
            })}
          </div>
          <div className={styles.topoParentArrowWrap}>
            <svg width="12" height="18" viewBox="0 3 12 18" className={styles.topoParentArrow}>
              <path
                d="M 6 18 L 6 4 M 2 8 L 6 4 L 10 8"
                stroke="var(--base-fg-more-dim)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
            <span className={styles.topoParentPredicate}>
              {getRelationDisplayLabel(parents[0]!)}
            </span>
          </div>
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
            {groupByField(usedByRefs).map(group => (
              <div key={group.key} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>{group.label}</div>
                {group.relations.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`in-${group.key}-${i}`) as React.Ref<HTMLButtonElement>}
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
            {groupByField(consumesRefs).map(group => (
              <div key={group.key} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>{group.label}</div>
                {group.relations.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`out-${group.key}-${i}`) as React.Ref<HTMLButtonElement>}
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
