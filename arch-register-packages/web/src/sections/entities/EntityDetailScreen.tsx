import { useMemo, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './EntityDetailScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import {
  TbChevronLeft,
  TbEdit,
  TbDots,
  TbTrash,
  TbCopy,
  TbBell,
  TbPinned,
  TbBookmark
} from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import {
  useEntity,
  useEntityRelations,
  useCloneEntity,
  useEntitiesBySchema
} from '../../hooks/useEntities';
import { useEntitySnapshots } from '../../hooks/useSnapshots';
import { useBypassEntityApproval, useEntityChangeProposal } from '../../hooks/useEntityChanges';
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
import { useWorkspacePermissions } from '../../auth/useWorkspacePermissions';
import { EntitySummary } from '@arch-register/api-types/entityContract';
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityContentView } from './EntityContentView';
import { EntityOverviewSection } from './components/EntityOverviewSection';
import { EntityContextSection } from './components/EntityContextSection';
import { EntityCollaborationSection } from './components/EntityCollaborationSection';
import { EntityPlanningReviewSection } from './components/EntityPlanningReviewSection';
import { Title } from '../../components/Title';
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
import { CollectionPickerDialog } from './components/CollectionPickerDialog';
import type { EntityChangeRevision } from '@arch-register/api-types/entityChangeContract';
import { useAuth } from '../../auth/AuthContext';
import { useDecideGovernanceAssignment, useGovernanceTasks } from '../../hooks/useGovernance';
import { entityChangeKeys } from '../../hooks/useEntityChanges';
import { entityKeys } from '../../queries/entities';

const proposalFieldLabels: Record<string, string> = {
  slug: 'Slug',
  namespace: 'Namespace',
  name: 'Name',
  description: 'Description',
  owner: 'Owner',
  lifecycle: 'Lifecycle',
  target_lifecycle: 'Target lifecycle',
  target_lifecycle_date: 'Target lifecycle date',
  tags: 'Tags',
  links: 'Links',
  schema_id: 'Schema',
  data: 'Entity fields',
  visibility_mode: 'Visibility'
};

const proposalStatusLabels: Record<EntityChangeRevision['status'], string> = {
  submitted: 'Awaiting approval',
  changes_requested: 'Changes requested',
  stale: 'Stale · resubmit required',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

const humanizeProposalKey = (key: string) =>
  key.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

const formatProposalValue = (value: unknown): string => {
  if (value == null || value === '') return 'Empty';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Empty';
    return value.map(formatProposalValue).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['name'] === 'string') return record['name'];
    if (typeof record['label'] === 'string') return record['label'];
    return Object.entries(record)
      .map(
        ([key, nestedValue]) => `${humanizeProposalKey(key)}: ${formatProposalValue(nestedValue)}`
      )
      .join(' · ');
  }
  return String(value);
};

const proposalValuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null || right == null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => proposalValuesEqual(value, right[index]));
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys].every(key => proposalValuesEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
};

const proposalDiffRows = (revision: EntityChangeRevision) =>
  Object.entries(revision.diff).flatMap(([key, change]) => {
    const values = change as { before?: unknown; after?: unknown };
    if (
      key === 'data' &&
      values.before != null &&
      typeof values.before === 'object' &&
      !Array.isArray(values.before) &&
      values.after != null &&
      typeof values.after === 'object' &&
      !Array.isArray(values.after)
    ) {
      const before = values.before as Record<string, unknown>;
      const after = values.after as Record<string, unknown>;
      return [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(field => !proposalValuesEqual(before[field], after[field]))
        .map(field => ({
          field: `Entity field · ${humanizeProposalKey(field)}`,
          before: before[field],
          after: after[field]
        }));
    }
    return [
      {
        field: proposalFieldLabels[key] ?? humanizeProposalKey(key),
        before: values.before,
        after: values.after
      }
    ];
  });

const EntityChangeProposalPanel = ({
  revision,
  workspaceId,
  entityId,
  canOverrideApproval
}: {
  revision: EntityChangeRevision;
  workspaceId: string;
  entityId: string;
  canOverrideApproval: boolean;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bypass = useBypassEntityApproval(workspaceId, entityId);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
  const [bypassReason, setBypassReason] = useState('');
  const { data: governanceTasks = [] } = useGovernanceTasks(workspaceId, {
    caseKind: 'entity.change',
    state: 'open'
  });
  const decide = useDecideGovernanceAssignment(workspaceId);
  const approvalTask = governanceTasks.find(
    task =>
      task.case.id === revision.caseId &&
      task.assignment.action === 'approve' &&
      task.requiresAction &&
      (task.case.initiatorUserId !== user?.id || task.case.selfApprovalAllowed)
  );
  const status = proposalStatusLabels[revision.status];
  const rows = proposalDiffRows(revision);
  const approve = () => {
    if (!approvalTask) return;
    decide.mutate(
      { assignmentId: approvalTask.assignment.id, decision: 'approve' },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: entityChangeKeys.current(workspaceId, entityId)
            }),
            queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) })
          ]);
        }
      }
    );
  };
  const executeBypass = () => {
    const reason = bypassReason.trim();
    if (reason === '') return;
    bypass.mutate(
      {
        baseVersion: revision.baseVersion,
        proposedState: revision.proposedState,
        reason
      },
      {
        onSuccess: () => {
          setBypassDialogOpen(false);
          setBypassReason('');
        }
      }
    );
  };
  return (
    <>
      <section className={styles.proposalPanel} aria-labelledby="entity-change-proposal-title">
        <div className={styles.proposalHeader}>
          <div>
            <div className={styles.proposalEyebrow}>Entity change proposal</div>
            <h2 id="entity-change-proposal-title" className={styles.proposalTitle}>
              Revision {revision.revisionNumber}
            </h2>
            <div className={styles.proposalMeta}>
              Proposed by {revision.createdByName ?? 'Unknown user'} ·{' '}
              {new Date(revision.createdAt).toLocaleString()}
            </div>
          </div>
          <div className={styles.proposalActions}>
            <span className={styles.proposalStatus}>{status}</span>
            {approvalTask && (
              <Button variant="primary" onClick={approve} disabled={decide.isPending}>
                {decide.isPending ? 'Approving…' : 'Approve change'}
              </Button>
            )}
            {canOverrideApproval && (
              <Button
                variant="danger"
                onClick={() => setBypassDialogOpen(true)}
                disabled={bypass.isPending}
              >
                Bypass approval
              </Button>
            )}
          </div>
        </div>
        {revision.message && <p className={styles.proposalMessage}>{revision.message}</p>}
        <div className={styles.proposalDiff}>
          <div className={styles.proposalDiffHeader}>
            <span>Field</span>
            <span>Current value</span>
            <span>Proposed value</span>
          </div>
          {rows.map(row => (
            <div className={styles.proposalDiffRow} key={row.field}>
              <strong className={styles.proposalField}>{row.field}</strong>
              <span className={styles.proposalBefore}>{formatProposalValue(row.before)}</span>
              <span className={styles.proposalAfter}>{formatProposalValue(row.after)}</span>
            </div>
          ))}
        </div>
      </section>
      <Dialog
        open={bypassDialogOpen}
        onClose={() => setBypassDialogOpen(false)}
        title="Bypass approval?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setBypassDialogOpen(false) },
          {
            label: bypass.isPending ? 'Applying…' : 'Bypass approval',
            type: 'danger',
            disabled: bypass.isPending || bypassReason.trim() === '',
            onClick: executeBypass
          }
        ]}
      >
        <p>
          This applies the proposed changes immediately and closes the approval case. Enter a reason
          for the audited override.
        </p>
        <FormElement label="Reason (required)">
          <TextInput
            value={bypassReason}
            onChange={value => setBypassReason(value ?? '')}
            placeholder="Explain why approval is being bypassed"
            style={{ width: '100%' }}
          />
        </FormElement>
      </Dialog>
    </>
  );
};

export const EntityDetailScreen = ({ folder }: { folder?: string } = {}) => {
  const navigate = useNavigate();
  const { entityId: routeEntityId } = useParams({ strict: false });
  const entityId = routeEntityId!;
  const search = useSearch({ strict: false }) as EntityDetailSearchParams;
  const { workspaceSlug, schemas, lifecycleStates, teams, permissions } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const { canOverrideEntityApproval } = useWorkspacePermissions(workspaceId);
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
  const { data: changeProposal, isLoading: changeProposalLoading } = useEntityChangeProposal(
    workspaceId,
    entityId
  );
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
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);

  const schema = schemaEntry?.schema ?? null;
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
    canBypassApproval:
      approvalRequired &&
      canOverrideEntityApproval &&
      !changeProposalLoading &&
      changeProposal == null,
    onDeleted: navigateToEntities
  });

  const handleClone = async () => {
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

  const entityName = entity._name || entity._slug;
  const latestProposalRevision = changeProposal?.revisions.at(-1);
  const menuItems: MenuItem[] = [
    {
      label: 'Collections…',
      icon: <TbBookmark size={14} />,
      onClick: () => setCollectionPickerOpen(true)
    },
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
              entity._lifecycle || changeProposal ? (
                <>
                  {entity._lifecycle && (
                    <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  )}
                  {entity._targetLifecycle &&
                    entity._lifecycle &&
                    entity._targetLifecycle.id !== entity._lifecycle.id && (
                      <>
                        <span>→</span>
                        <StatusChip
                          value={entity._targetLifecycle.id}
                          lifecycleStates={lifecycleStates}
                        />
                      </>
                    )}
                  {changeProposal && (
                    <span>
                      {changeProposal.revisions.at(-1)?.status === 'changes_requested'
                        ? 'Changes requested'
                        : 'Approval pending'}
                    </span>
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
                    {isSaving ? 'Saving...' : approvalRequired ? 'Request approval' : 'Save'}
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

      {/* Content folder view */}
      {!contentFolder && latestProposalRevision && (
        <EntityChangeProposalPanel
          revision={latestProposalRevision}
          workspaceId={workspaceId}
          entityId={entityId}
          canOverrideApproval={canOverrideEntityApproval}
        />
      )}

      {contentFolder && (
        <EntityContentView
          workspaceSlug={workspaceSlug}
          entityId={entityId}
          folder={contentFolder}
        />
      )}

      {/* Overview / Relationships / Change history */}
      {!contentFolder && HOME_TAB_IDS.includes(tab) && (
        <EntityOverviewSection
          tab={tab}
          setTab={setTab}
          relationCount={relationCount}
          canViewAudit={canViewAudit}
          overviewProps={{
            workspaceSlug,
            entity,
            schema,
            editing,
            editState,
            setEditState,
            editLinks,
            setEditLinks,
            validationErrors,
            setValidationErrors,
            refLookup,
            referenceOptions,
            teams,
            lifecycleStates,
            entityProjects,
            futureSnapshots,
            entityDiagramFiles
          }}
          relationsProps={{ outgoing, incoming, schemas }}
          changeHistoryProps={{
            workspaceId,
            entityId,
            entity,
            schema,
            snapshots: allSnapshots,
            lifecycleStates,
            teams,
            canViewAudit
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
            rootEntityName: entity._name || entity._slug,
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
            allSnapshots,
            entityProjects,
            schema,
            lifecycleStates,
            teams
          }}
        />
      )}

      <Dialog
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="Save changes"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setSaveConfirmOpen(false) },
          {
            label: isSaving ? 'Saving...' : approvalRequired ? 'Request approval' : 'Save',
            type: 'default',
            disabled: isSaving,
            onClick: executeSave
          },
          ...(approvalRequired &&
          canOverrideEntityApproval &&
          !changeProposalLoading &&
          changeProposal == null
            ? [
                {
                  label: isSaving ? 'Bypassing...' : 'Bypass approval',
                  type: 'danger' as const,
                  disabled: isSaving || saveConfirmMessage.trim() === '',
                  onClick: executeBypass
                }
              ]
            : [])
        ]}
      >
        <FormElement
          label={
            approvalRequired && canOverrideEntityApproval
              ? 'Note / bypass reason (required for bypass)'
              : 'Note (optional)'
          }
        >
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
      {collectionPickerOpen && (
        <CollectionPickerDialog
          open={true}
          workspaceId={workspaceId}
          entityId={entity._uid}
          entityName={entityName}
          onClose={() => setCollectionPickerOpen(false)}
        />
      )}
    </div>
  );
};
