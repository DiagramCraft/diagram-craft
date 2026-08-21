import { useMemo, useCallback, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './EntityDetailScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TbChevronLeft } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { useGovernanceInitiationFields } from '../../hooks/useGovernanceInitiationFields';
import {
  useEntity,
  useEntityJson,
  useEntityRelations,
  useCloneEntity,
  useEntitiesBySchema
} from '../../hooks/useEntities';
import { useEntityTypedRelations } from '../../hooks/useRelations';
import { useEntityVersions } from '../../hooks/useEntityVersions';
import { useChangeCasesByEntity } from '../../hooks/useChangeCases';
import { useEntityChangeApproval } from '../../hooks/useEntityChanges';
import { useEntityDeprecation } from '../../hooks/useEntityDeprecation';
import { EntityDeprecationPanel } from './components/EntityDeprecationPanel';
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
import { useWorkspaceCapabilityConfigurations } from '../../hooks/useWorkspaceConfig';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { EntitySummary } from '@arch-register/api-types/entityContract';
import type { WorkspaceCapabilityBinding } from '@arch-register/api-types/workspaceCapabilityContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import { EntityContentView } from './EntityContentView';
import { EntityChangeApprovalPanel } from './components/EntityChangeApprovalPanel';
import { EntityDetailDialogs } from './components/EntityDetailDialogs';
import { EntityDetailHeader } from './components/EntityDetailHeader';
import { EntityOverviewSection } from './components/EntityOverviewSection';
import { EntityContextSection } from './components/EntityContextSection';
import { EntityCollaborationSection } from './components/EntityCollaborationSection';
import { EntityPlanningReviewSection } from './components/EntityPlanningReviewSection';
import { EntityApiSection } from './EntityApiSection';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import {
  HOME_TAB_IDS,
  CONTEXT_TAB_IDS,
  COLLABORATION_TAB_IDS,
  PLANNING_TAB_IDS,
  type TabId,
  type Relation
} from './types/entityDetailTypes';
import type { EntityDetailSearchParams } from '../../routes/searchParams';
import { buildEntityRefLookup } from './entityDetailHelpers';
import { buildDefaultLayout } from '../../lib/detailLayoutDefaults';
import { flattenChangeCaseMembers } from './components/snapshotDisplay';

export const EntityDetailScreen = ({ folder }: { folder?: string } = {}) => {
  const navigate = useNavigate();
  const { entityId: routeEntityId } = useParams({ strict: false });
  const entityId = routeEntityId!;
  const search = useSearch({ strict: false }) as EntityDetailSearchParams;
  const {
    workspaceSlug,
    schemas,
    relationSchemas,
    lifecycleStates,
    teams,
    currencies,
    permissions
  } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const { canOverrideEntityApproval } = useWorkspaceAuthorization(workspaceId);
  const { data: workspaceCapabilityConfigurations = [] } =
    useWorkspaceCapabilityConfigurations(workspaceId);
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
  // Query hooks
  const { data: entity, isLoading: loading } = useEntity(workspaceId, entityId);
  const [viewJsonOpen, setViewJsonOpen] = useState(false);
  const { data: entityJson, isLoading: entityJsonLoading } = useEntityJson(
    workspaceId,
    entityId,
    viewJsonOpen
  );
  const { data: changeApproval, isLoading: changeApprovalLoading } = useEntityChangeApproval(
    workspaceId,
    entityId
  );
  const { data: deprecation } = useEntityDeprecation(workspaceId, entityId);
  const { data: relations = { outgoing: [], incoming: [] } } = useEntityRelations(
    workspaceId,
    entityId
  );
  const { data: typedRelations = { outgoing: [], incoming: [] } } = useEntityTypedRelations(
    workspaceId,
    entity?._uid ?? entityId
  );

  // Project association hooks
  const { data: entityProjects = [] } = useEntityProjects(workspaceId, entityId);
  const { data: entityDiagramFiles = [] } = useEntityDiagramFiles(workspaceId, entityId);

  // Mutation hooks
  const cloneEntity = useCloneEntity(workspaceId);
  const { data: entityVersions = [] } = useEntityVersions(workspaceId, entityId, true);
  const { data: entityChangeCases = [] } = useChangeCasesByEntity(workspaceId, entityId, true);
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
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [proposeDeprecationOpen, setProposeDeprecationOpen] = useState(false);
  const [initiationFieldValues, setInitiationFieldValues] = useState<Record<string, unknown>>({});

  const schema = schemaEntry?.schema ?? null;
  // The schema's configurable detail layout contributes its own tabs (e.g. "Details",
  // "Technical") to the top-level tab bar, in place of a single static "Overview" tab.
  const layout = useMemo(
    () => schema?.detail_layout ?? buildDefaultLayout(schema, relationSchemas),
    [schema, relationSchemas]
  );
  const defaultTabId = layout.tabs[0]?.id ?? 'overview';
  const homeTabIds = useMemo(
    () => [
      ...layout.tabs.map(layoutTab => layoutTab.id),
      ...HOME_TAB_IDS.filter(id => id !== 'overview')
    ],
    [layout]
  );
  const requestedTab = search.tab ?? defaultTabId;
  const setTab = useCallback(
    (nextTab: TabId) => {
      const route = contentFolder
        ? entityContentFolderRoute(workspaceSlug, asEntityPublicId(entityId), contentFolder)
        : entityDetailRoute(workspaceSlug, asEntityPublicId(entityId));
      navigate({
        ...route,
        search: {
          ...search,
          tab: nextTab === defaultTabId ? undefined : nextTab
        }
      });
    },
    [contentFolder, entityId, navigate, search, workspaceSlug, defaultTabId]
  );
  const workspaceApiConfiguration = workspaceCapabilityConfigurations.find(
    configuration => configuration.type === 'api-specification'
  );
  const workspaceApiBinding = workspaceApiConfiguration?.bindings.api;
  const workspaceApiTargetMatches =
    workspaceApiConfiguration?.valid === true &&
    workspaceApiBinding?.target.kind === 'entity_schema' &&
    workspaceApiBinding.target.id === schema?.id;
  const apiCapability: WorkspaceCapabilityBinding | undefined = workspaceApiTargetMatches
    ? workspaceApiBinding
    : undefined;
  const apiCapable = apiCapability !== undefined;
  const tab = requestedTab === 'api' && !apiCapable ? defaultTabId : requestedTab;
  const updateApiSearch = useCallback(
    (patch: Partial<EntityDetailSearchParams>, replace = true) => {
      const route = contentFolder
        ? entityContentFolderRoute(workspaceSlug, asEntityPublicId(entityId), contentFolder)
        : entityDetailRoute(workspaceSlug, asEntityPublicId(entityId));
      navigate({
        ...route,
        search: { ...search, ...patch },
        replace
      });
    },
    [contentFolder, entityId, navigate, search, workspaceSlug]
  );
  const { fields: entityInitiationFields } = useGovernanceInitiationFields(
    workspaceId,
    'entity.change-case',
    schema?.id ?? null
  );
  const approvalRequired =
    entity?._approvalPolicyOverride === 'required' ||
    (entity?._approvalPolicyOverride !== 'disabled' &&
      (schema?.entity_approval_policy ?? 'disabled') === 'required');
  const color = schemaEntry
    ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
    : 'var(--accent-fg)';

  // Get reference field schema IDs
  const referenceSchemaIds = useMemo(() => {
    if (!schema) return [];
    return [
      ...new Set(
        schema.fields
          .filter(isReferenceOrContainmentField)
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
  const futurePlansCount = flattenChangeCaseMembers(entityChangeCases).filter(
    entry => entry.changeCase.status === 'planned'
  ).length;

  const {
    editing,
    editState,
    setEditState,
    typedRelationEditState,
    setTypedRelationEditState,
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
    saveConfirmDueDate,
    setSaveConfirmDueDate,
    saveConfirmSignificant,
    setSaveConfirmSignificant,
    saveError,
    executeSave,
    executeBypass,
    confirmDelete,
    setConfirmDelete,
    handleDelete,
    doDelete
  } = useEntityEditController({
    workspaceId,
    entityId,
    entity,
    schema,
    approvalRequired,
    initiationFieldValues,
    canBypassApproval:
      approvalRequired &&
      canOverrideEntityApproval &&
      !changeApprovalLoading &&
      changeApproval == null,
    onDeleted: navigateToEntities
  });

  const handleClone = () => {
    cloneEntity.mutate(entityId, {
      onSuccess: cloned => navigateToEntity(cloned._publicId)
    });
  };

  if (loading) {
    return <LoadingState text="Loading..." />;
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

  const entityName = entity._name ?? entity._slug;
  const latestApprovalRevision = changeApproval?.revisions.at(-1);

  return (
    <div className={`${styles.screen} ${tab === 'graph' ? styles.graphMode : ''}`}>
      {/* Header - hidden when viewing folder content */}
      {!contentFolder && (
        <EntityDetailHeader
          entity={entity}
          entityName={entityName}
          schema={schema}
          schemaColor={color}
          lifecycleStates={lifecycleStates}
          changeApproval={changeApproval}
          deprecation={deprecation}
          editing={editing}
          isWatched={isWatched}
          isPinned={isPinned}
          approvalRequired={approvalRequired}
          isSaving={isSaving}
          saveConfirmOpen={saveConfirmOpen}
          watchPending={createWatch.isPending || deleteWatch.isPending}
          pinPending={createPinnedEntity.isPending || deletePinnedEntity.isPending}
          onHome={() => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })}
          onEntities={navigateToEntities}
          onToggleWatch={() =>
            isWatched
              ? deleteWatch.mutate(entity._uid ?? entityId)
              : createWatch.mutate(entity._uid ?? entityId)
          }
          onTogglePin={() =>
            isPinned
              ? deletePinnedEntity.mutate(entity._uid ?? entityId)
              : createPinnedEntity.mutate({
                  entityId: entity._uid ?? entityId,
                  entityPublicId: entity._publicId ?? entityId,
                  entityName: entity._name ?? entity._slug,
                  entitySlug: entity._slug,
                  schemaId: entity._schema.id
                })
          }
          onStartEdit={startEdit}
          onDelete={handleDelete}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onViewJson={() => setViewJsonOpen(true)}
          onOpenCollections={() => setCollectionPickerOpen(true)}
          onProposeDeprecation={() => setProposeDeprecationOpen(true)}
          onClone={handleClone}
        />
      )}

      {/* Content folder view */}
      {!contentFolder && latestApprovalRevision && (
        <EntityChangeApprovalPanel
          revision={latestApprovalRevision}
          workspaceId={workspaceId}
          entityId={entityId}
          canOverrideApproval={canOverrideEntityApproval}
        />
      )}

      {!contentFolder && deprecation && (
        <EntityDeprecationPanel
          deprecation={deprecation}
          workspaceId={workspaceId}
          entityId={entityId}
          teams={teams}
        />
      )}

      {contentFolder && (
        <EntityContentView
          workspaceSlug={workspaceSlug}
          entityId={entityId}
          folder={contentFolder}
        />
      )}

      {!contentFolder && tab === 'api' && apiCapable && (
        <EntityApiSection
          workspaceId={workspaceId}
          entity={entity}
          capabilityBinding={apiCapability}
          outgoing={outgoing}
          incoming={incoming}
          search={search}
          onSearchChange={updateApiSearch}
        />
      )}

      {/* Overview / Relationships / Change history */}
      {!contentFolder && homeTabIds.includes(tab) && (
        <EntityOverviewSection
          tab={tab}
          setTab={setTab}
          layout={layout}
          relationCount={relationCount}
          futurePlansCount={futurePlansCount}
          canViewAudit={canViewAudit}
          overviewProps={{
            workspaceSlug,
            entity,
            schema,
            editing,
            editState,
            setEditState,
            typedRelationEditState,
            setTypedRelationEditState,
            editLinks,
            setEditLinks,
            validationErrors,
            setValidationErrors,
            refLookup,
            referenceOptions,
            teams,
            lifecycleStates,
            currencies: currencies.currencies,
            defaultCurrency: currencies.default_currency,
            entityProjects,
            entityDiagramFiles,
            typedRelationsOutgoing: typedRelations.outgoing,
            typedRelationsIncoming: typedRelations.incoming,
            relationSchemas
          }}
          relationsProps={{
            workspaceId,
            outgoing,
            incoming,
            schemas,
            relationSchemas,
            typedRelationsOutgoing: typedRelations.outgoing,
            typedRelationsIncoming: typedRelations.incoming,
            entityId: entity._uid,
            entitySchemaId: schema?.id ?? '',
            entityName: entity._name
          }}
          changeHistoryProps={{
            workspaceId,
            entityId,
            entity,
            schema,
            versions: entityVersions,
            lifecycleStates,
            teams,
            canViewAudit
          }}
          futurePlansProps={{
            workspaceId,
            entityProjects,
            changeCases: entityChangeCases
          }}
        />
      )}

      {/* Context: Topology / Graph / Dependents / Related content */}
      {!contentFolder && CONTEXT_TAB_IDS.includes(tab) && (
        <EntityContextSection
          tab={tab}
          setTab={setTab}
          dependentsCount={incoming.length}
          topologyProps={{
            workspaceId,
            entity,
            schema,
            color,
            outgoing,
            incoming,
            schemas,
            lifecycleStates,
            onEntityClick: navigateToEntity
          }}
          graphProps={{
            workspaceId,
            rootEntityId: entity._uid,
            rootEntityName: entity._name ?? entity._slug,
            rootEntitySchemaId: entity._schema.id,
            schemas,
            onEntityClick: navigateToEntity
          }}
          dependentsProps={{ workspaceId, entityId, schemas, lifecycleStates }}
          relatedContentProps={{ workspaceId, entityId }}
        />
      )}

      {/* Collaboration: Discussion */}
      {!contentFolder && COLLABORATION_TAB_IDS.includes(tab) && (
        <EntityCollaborationSection
          tab={tab}
          setTab={setTab}
          discussionProps={{ workspaceId, objectType: 'entity', objectId: entity._uid }}
        />
      )}

      {/* Planning & review: Assessments / Timeline */}
      {!contentFolder && PLANNING_TAB_IDS.includes(tab) && (
        <EntityPlanningReviewSection
          tab={tab}
          setTab={setTab}
          assessmentsProps={{ workspaceId, entity, schema }}
          timelineProps={{
            workspaceId,
            versions: entityVersions,
            changeCases: entityChangeCases,
            entityProjects,
            schema,
            lifecycleStates,
            teams
          }}
        />
      )}

      <EntityDetailDialogs
        entity={entity}
        entityName={entityName}
        workspaceId={workspaceId}
        entityId={entityId}
        viewJsonOpen={viewJsonOpen}
        setViewJsonOpen={setViewJsonOpen}
        entityJson={entityJson}
        entityJsonLoading={entityJsonLoading}
        saveConfirmOpen={saveConfirmOpen}
        setSaveConfirmOpen={setSaveConfirmOpen}
        saveConfirmMessage={saveConfirmMessage}
        setSaveConfirmMessage={setSaveConfirmMessage}
        saveConfirmDueDate={saveConfirmDueDate}
        setSaveConfirmDueDate={setSaveConfirmDueDate}
        saveConfirmSignificant={saveConfirmSignificant}
        setSaveConfirmSignificant={setSaveConfirmSignificant}
        saveError={saveError}
        isSaving={isSaving}
        approvalRequired={approvalRequired}
        canOverrideApproval={canOverrideEntityApproval}
        changeApprovalLoading={changeApprovalLoading}
        hasChangeApproval={changeApproval != null}
        executeSave={executeSave}
        executeBypass={executeBypass}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        doDelete={doDelete}
        collectionPickerOpen={collectionPickerOpen}
        setCollectionPickerOpen={setCollectionPickerOpen}
        proposeDeprecationOpen={proposeDeprecationOpen}
        setProposeDeprecationOpen={setProposeDeprecationOpen}
        entityInitiationFields={entityInitiationFields}
        initiationFieldValues={initiationFieldValues}
        setInitiationFieldValues={setInitiationFieldValues}
      />
    </div>
  );
};
