import { useMemo, useCallback } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './EntityDetailScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import { TbChevronLeft, TbEdit, TbDots, TbTrash, TbCopy, TbBell, TbPinned } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { useEntity, useEntityRelations, useCloneEntity, useEntitiesBySchema } from '../../hooks/useEntities';
import { useEntitySnapshots } from '../../hooks/useSnapshots';
import { useEntityEditController } from '../../hooks/useEntityEditController';
import { useEntityDiagramFiles, useEntityProjects } from '../../hooks/useProjects';
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
  entityContentFolderRoute,
  entityDetailRoute
} from '../../routes/publicObjectRoutes';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EntityGraphView } from './components/EntityGraphView';
import { EntitySummary } from '@arch-register/api-types/entityContract';
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityContentView } from './EntityContentView';
import { EntityOverviewTab } from './components/EntityOverviewTab';
import { EntityTopologyTab } from './components/EntityTopologyTab';
import { EntityRelationsTab } from './components/EntityRelationsTab';
import { EntityTimelineTab } from './components/EntityTimelineTab';
import { EntityChangeHistoryTab } from './components/EntityChangeHistoryTab';
import { Title } from '../../components/Title';
import { EntityDependentsTab } from './components/EntityDependentsTab';
import { EntityAssessmentsTab } from './components/EntityAssessmentsTab';
import { DiscussionThread } from '../discussions/DiscussionThread';
import { EmptyState } from '../../components/EmptyState';
import type { TabId, Relation } from './types/entityDetailTypes';
import type { EntityDetailSearchParams } from '../../routes/searchParams';
import { buildEntityRefLookup } from './entityDetailHelpers';

export const EntityDetailScreen = ({ folder }: { folder?: string } = {}) => {
  const navigate = useNavigate();
  const { entityId: routeEntityId } = useParams({ strict: false });
  const entityId = routeEntityId!;
  const search = useSearch({ strict: false }) as EntityDetailSearchParams;
  const { workspaceSlug, schemas, lifecycleStates, teams, permissions } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const canViewAudit = permissions.canViewAudit;
  const contentFolder = folder ?? null;

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
      const route = contentFolder
        ? entityContentFolderRoute(workspaceSlug, asEntityPublicId(entityId), contentFolder)
        : entityDetailRoute(workspaceSlug, asEntityPublicId(entityId));
      navigate({
        ...route,
        search: {
          ...search,
          tab: nextTab === 'overview' ? undefined : nextTab
        }
      });
    },
    [contentFolder, entityId, navigate, search, workspaceSlug]
  );
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
  const cloneEntity = useCloneEntity(workspaceId);
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
  const refLookup = useMemo(() => buildEntityRefLookup(relations), [relations]);

  const outgoing: Relation[] = relations.outgoing;
  const incoming: Relation[] = relations.incoming;
  const relationCount = outgoing.length + incoming.length;

  const {
    editing,
    editState,
    setEditState,
    editLinks,
    setEditLinks,
    validationErrors,
    setValidationErrors,
    startEdit,
    cancelEdit,
    saveEdit,
    isSaving,
    saveConfirmOpen,
    setSaveConfirmOpen,
    saveConfirmMessage,
    setSaveConfirmMessage,
    saveConfirmSignificant,
    setSaveConfirmSignificant,
    executeSave,
    confirmDelete,
    setConfirmDelete,
    handleDelete,
    doDelete
  } = useEntityEditController({
    workspaceId,
    entityId,
    entity,
    schema,
    onDeleted: navigateToEntities
  });

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
      <EmptyState
        title="Entity not found"
        subtitle="The entity may have been deleted."
        action={
          <Button icon={<TbChevronLeft size={12} />} onClick={() => navigateToEntities()}>
            Back to entities
          </Button>
        }
      />
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
                    disabled={isSaving || saveConfirmOpen}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
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
            <Tabs.List overflow>
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
          teams={teams}
          lifecycleStates={lifecycleStates}
          entityProjects={entityProjects}
          futureSnapshots={futureSnapshots}
          entityDiagramFiles={entityDiagramFiles}
        />
      )}

      {/* Topology */}
      {!contentFolder && tab === 'topology' && (
        <EntityTopologyTab
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
        />
      )}

      {/* Dependents (impact analysis) */}
      {!contentFolder && tab === 'dependents' && (
        <EntityDependentsTab
          workspaceId={workspaceId}
          entityId={entityId}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
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
            label: isSaving ? 'Saving...' : 'Save',
            type: 'default',
            disabled: isSaving,
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
