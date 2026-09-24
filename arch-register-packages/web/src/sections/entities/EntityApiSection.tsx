import { useEffect, useState } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { WorkspaceCapabilityBinding } from '@arch-register/api-types/workspaceCapabilityContract';
import type {
  ApiSpecificationProtocol,
  ApiSpecificationRevision,
  Artifact
} from '@arch-register/api-types/artifactContract';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId
} from '@arch-register/api-types/integrationCatalog';
import { Button } from '@diagram-craft/app-components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Chip } from '../../components/Chip';
import { EntityNavigationLink } from '../../components/EntityNavigationLink';
import { getRelationDisplayLabel } from '../../lib/entityRelations';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { useDateTimeFormatPreference } from '../../hooks/useDateTimeFormatPreference';
import {
  getArtifactStatusLabel,
  resolveApiSpecificationSelection,
  useArtifactRevisionContent,
  useCreateApiSpecificationSource,
  useRefreshApiSpecification,
  useUploadApiSpecification
} from '../../hooks/useArtifacts';
import {
  ApiFilters,
  ApiItemRow,
  ApiSourceVersionPicker,
  PAGE_SIZE,
  RawSourceDialog,
  RevisionDiagnostics,
  StatusNotice,
  formatDate,
  protocolLabel,
  statusTone,
  useApiSpecificationCatalogQuery,
  useApiSpecificationSources
} from './components/ApiSpecificationCatalog';
import type { ApiCatalogFilterValues } from './components/ApiSpecificationCatalog';
import { ApiSpecificationSourceDialog } from './ApiSpecificationSourceDialog';
import { UploadApiSpecificationDialog } from './UploadApiSpecificationDialog';
import type { Relation } from './types/entityDetailTypes';
import type { EntityDetailSearchParams } from '../../routes/searchParams';
import styles from './EntityApiSection.module.css';
import sharedStyles from './EntityDetailScreen.module.css';
import { TbAlertTriangle, TbExternalLink, TbLink, TbRefresh, TbUpload } from 'react-icons/tb';

type Props = {
  workspaceId: string;
  entity: EntityRecord;
  capabilityBinding?: WorkspaceCapabilityBinding;
  outgoing: Relation[];
  incoming: Relation[];
  search: EntityDetailSearchParams;
  onSearchChange: (patch: Partial<EntityDetailSearchParams>, replace?: boolean) => void;
};

const readStringField = (entity: EntityRecord, fieldId: string) => {
  const value = entity[fieldId];
  return typeof value === 'string' ? value : undefined;
};

const readMappedStringField = (
  entity: EntityRecord,
  binding: WorkspaceCapabilityBinding,
  roleId: string
) => {
  const definition = getWorkspaceCapabilityDefinition('api-specification');
  const role = definition?.bindingRoles
    .find(candidate => candidate.id === 'api')
    ?.fieldRoles.find(candidate => candidate.id === roleId);
  return readStringField(entity, role ? resolveCapabilityFieldId(binding, role) : roleId);
};

const isApiContextRelation = (relation: Relation) => {
  const label = getRelationDisplayLabel(relation).toLowerCase();
  return label.includes('provide') || label.includes('consume');
};

const ApiContext = ({
  entityName,
  outgoing,
  incoming
}: Pick<Props, 'outgoing' | 'incoming'> & { entityName: string }) => {
  const contextRelations = [
    ...outgoing.map(relation => ({ relation, direction: 'outgoing' as const })),
    ...incoming.map(relation => ({ relation, direction: 'incoming' as const }))
  ].filter(item => isApiContextRelation(item.relation));

  if (contextRelations.length === 0) return null;

  return (
    <section className={styles.contextSection} aria-label="API context">
      <div className={sharedStyles.sectionLabel}>Provider and consumer context</div>
      <div className={styles.contextList}>
        {contextRelations.map(({ relation, direction }, index) => {
          const isIncoming = direction === 'incoming';
          const subject = isIncoming ? relation.entityName : entityName;
          const object = isIncoming ? entityName : relation.entityName;

          return (
            <EntityNavigationLink
              key={`${relation.publicId}-${getRelationDisplayLabel(relation)}-${index}`}
              publicId={relation.publicId}
              className={styles.contextRow}
            >
              <span className={styles.contextEntity}>{subject}</span>
              <span className={styles.contextPredicate}>{getRelationDisplayLabel(relation)}</span>
              <span className={styles.contextEntity}>{object}</span>
            </EntityNavigationLink>
          );
        })}
      </div>
    </section>
  );
};

const ApiMetadata = ({
  entity,
  capabilityBinding,
  artifact,
  revision,
  protocol,
  selectionRequired,
  canManageArtifacts,
  isRefreshing,
  onRefresh
}: {
  entity: EntityRecord;
  capabilityBinding: WorkspaceCapabilityBinding;
  artifact: Artifact | undefined;
  revision: ApiSpecificationRevision | undefined;
  protocol: ApiSpecificationProtocol | null | undefined;
  selectionRequired: boolean;
  canManageArtifacts: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const declaredType = readMappedStringField(entity, capabilityBinding, 'api_type');
  const declaredVersion = readMappedStringField(entity, capabilityBinding, 'api_version');
  const statusLabel = selectionRequired
    ? 'Select source'
    : getArtifactStatusLabel(artifact?.status ?? 'not_configured');
  const revisionLabel = revision
    ? (revision.revision.sourceRevision ?? revision.revision.id)
    : (artifact?.currentRevisionId ?? 'None');

  return (
    <section className={styles.metadata} aria-label="API specification metadata">
      <div className={styles.metadataHeader}>
        <div>
          <div className={styles.eyebrow}>API catalog</div>
          <h2 className={styles.title}>{entity._name ?? entity._slug}</h2>
        </div>
        <div className={`${styles.status} ${statusTone(artifact?.status ?? 'not_configured')}`}>
          {statusLabel}
        </div>
      </div>
      <div className={styles.metadataGrid}>
        <MetadataItem label="Declared type" value={declaredType ?? 'Not set'} />
        <MetadataItem label="API version" value={declaredVersion ?? 'Not set'} />
        <MetadataItem label="Protocol" value={protocolLabel(protocol)} />
        <MetadataItem label="Source kind" value={artifact?.kind ?? 'Not selected'} />
        <MetadataItem label="Media type" value={artifact?.mediaType ?? 'Not available'} />
        <MetadataItem
          label="Last attempt"
          value={formatDate(artifact?.lastAttemptAt, dateTimeFormatPreference)}
        />
        <MetadataItem
          label="Last success"
          value={formatDate(artifact?.lastSuccessAt, dateTimeFormatPreference)}
        />
        <MetadataItem label="Revision" value={revisionLabel} />
        <MetadataItem
          label="Selected version"
          value={revision ? (revision.isCurrent ? 'Current' : 'Historical') : 'None'}
        />
        <MetadataItem
          label="Accepted at"
          value={formatDate(revision?.revision.createdAt, dateTimeFormatPreference)}
        />
      </div>
      {selectionRequired && (
        <div className={styles.sourceNotice}>
          <TbAlertTriangle size={13} />
          Multiple API sources are attached. Select a source and version to browse its catalog.
        </div>
      )}
      {artifact?.diagnostic && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <TbAlertTriangle size={13} />
          <span>
            <strong>{getArtifactStatusLabel(artifact.status)}:</strong>{' '}
            {artifact.diagnostic.message}
          </span>
        </div>
      )}
      {((artifact?.location?.length ?? 0) > 0 || entity._links.length > 0) && (
        <div className={styles.sourceActions}>
          {artifact?.location && (
            <a
              href={artifact.location}
              target="_blank"
              rel="noreferrer"
              className={styles.sourceLink}
            >
              <TbExternalLink size={13} />
              Open source
            </a>
          )}
          {entity._links.map(link => (
            <a
              key={`${link.url}-${link.title}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={styles.sourceLink}
            >
              <TbExternalLink size={13} />
              {link.title}
            </a>
          ))}
          {artifact?.kind === 'url' && canManageArtifacts && (
            <Button
              variant="ghost"
              size="xs"
              disabled={isRefreshing || artifact.status === 'pending'}
              onClick={onRefresh}
            >
              <TbRefresh size={13} />
              {isRefreshing ? 'Refreshing…' : 'Refresh source'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

const MetadataItem = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.metadataItem}>
    <span className={styles.metadataLabel}>{label}</span>
    <span className={styles.metadataValue}>{value}</span>
  </div>
);

export const EntityApiSection = ({
  workspaceId,
  entity,
  capabilityBinding,
  outgoing,
  incoming,
  search,
  onSearchChange
}: Props) => {
  const binding = capabilityBinding ?? {
    target: { kind: 'entity_schema' as const, id: entity._schema.id }
  };
  const { canManageArtifacts, canViewArtifactContent } = useWorkspaceAuthorization(workspaceId);
  const canManageApiArtifacts = canManageArtifacts && entity.canEdit;
  const { artifactsQuery, apiArtifacts, sources, revisionsLoading, revisionsError } =
    useApiSpecificationSources(workspaceId, entity._uid);
  const createSource = useCreateApiSpecificationSource(workspaceId, entity._uid);
  const refreshApiSpecification = useRefreshApiSpecification(workspaceId, entity._uid);
  const uploadApiSpecification = useUploadApiSpecification(workspaceId, entity._uid);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const selection = resolveApiSpecificationSelection(
    sources,
    search.apiArtifactId,
    search.apiRevisionId
  );
  const artifact = selection.artifact;
  const revision = selection.revision;
  const declaredType = readMappedStringField(entity, binding, 'api_type');
  const page = search.apiPage ?? 1;
  const filters: ApiCatalogFilterValues = {
    q: search.apiQ,
    resource: search.apiResource,
    action: search.apiAction,
    tag: search.apiTag,
    deprecated: search.apiDeprecated
  };
  const { projectionQueryResult, canLoadProjection, protocol } = useApiSpecificationCatalogQuery(
    workspaceId,
    entity._uid,
    artifact,
    revision,
    declaredType,
    filters,
    page,
    PAGE_SIZE
  );
  const [rawOpenRevisionId, setRawOpenRevisionId] = useState<string | null>(null);
  const rawSelectionKey = `${artifact?.id ?? ''}:${revision?.revision.id ?? ''}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when the selected source or revision changes
  useEffect(() => {
    setRawOpenRevisionId(null);
  }, [rawSelectionKey]);
  const rawContentQuery = useArtifactRevisionContent(
    workspaceId,
    entity._uid,
    artifact?.id ?? '',
    rawOpenRevisionId ?? '',
    rawOpenRevisionId != null && canViewArtifactContent
  );

  if (artifactsQuery.isLoading) {
    return <LoadingState text="Loading API catalog…" />;
  }

  if (artifactsQuery.isError) {
    return (
      <EmptyState
        title="API catalog unavailable"
        subtitle="The API artifact metadata could not be loaded."
        action={
          <Button variant="secondary" onClick={() => void artifactsQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const status = artifact?.status ?? 'not_configured';
  const selectedProtocol = projectionQueryResult.data?.revision.protocol ?? protocol;
  const total = projectionQueryResult.data?.total ?? 0;
  const items = projectionQueryResult.data?.items ?? [];
  const itemLabel = selectedProtocol === 'asyncapi' ? 'messages' : 'operations';
  const hasFilters = [
    search.apiQ,
    search.apiResource,
    search.apiAction,
    search.apiTag,
    search.apiDeprecated
  ].some(value => value !== undefined && value !== '');
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const selectionRequired = apiArtifacts.length > 1 && artifact == null;
  const handleSourceSelection = (artifactId: string, nextRevisionId?: string) =>
    onSearchChange(
      {
        apiArtifactId: artifactId,
        apiRevisionId: nextRevisionId,
        apiPage: undefined
      },
      true
    );
  const handleFilterChange = (patch: Partial<ApiCatalogFilterValues>) => {
    const mapped: Partial<EntityDetailSearchParams> = { apiPage: undefined };
    if ('q' in patch) mapped.apiQ = patch.q;
    if ('resource' in patch) mapped.apiResource = patch.resource;
    if ('action' in patch) mapped.apiAction = patch.action;
    if ('tag' in patch) mapped.apiTag = patch.tag;
    if ('deprecated' in patch) {
      mapped.apiDeprecated = patch.deprecated as 'true' | 'false' | undefined;
    }
    onSearchChange(mapped, true);
  };

  return (
    <main className={styles.page}>
      <ApiMetadata
        entity={entity}
        capabilityBinding={binding}
        artifact={artifact}
        revision={revision}
        protocol={selectedProtocol}
        selectionRequired={selectionRequired}
        canManageArtifacts={canManageApiArtifacts}
        isRefreshing={refreshApiSpecification.isPending}
        onRefresh={() => {
          if (artifact) void refreshApiSpecification.mutateAsync(artifact.id);
        }}
      />
      {apiArtifacts.length > 0 && (
        <ApiSourceVersionPicker
          sources={sources}
          selectedArtifactId={artifact?.id}
          selectedRevisionId={revision?.revision.id}
          revisionsLoading={revisionsLoading}
          onSelect={handleSourceSelection}
        />
      )}
      {revisionsError && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <TbAlertTriangle size={13} />
          One or more API source version histories could not be loaded. Retry the page to try again.
        </div>
      )}
      <ApiContext
        entityName={entity._name ?? entity._slug}
        outgoing={outgoing}
        incoming={incoming}
      />
      {artifact && <StatusNotice status={status} revision={revision} />}

      {apiArtifacts.length === 0 && (
        <EmptyState
          title="No API specification configured"
          subtitle="This schema supports API specifications, but this entity has no source attached yet."
          action={
            <div className={styles.sourceActions}>
              <Button
                variant="primary"
                icon={<TbUpload size={14} />}
                disabled={uploadApiSpecification.isPending || !canManageApiArtifacts}
                onClick={() => setUploadOpen(true)}
              >
                Upload API specification
              </Button>
              {canManageApiArtifacts && (
                <Button
                  variant="secondary"
                  icon={<TbLink size={14} />}
                  disabled={createSource.isPending}
                  onClick={() => setSourceOpen(true)}
                >
                  Add API source
                </Button>
              )}
            </div>
          }
        />
      )}

      {selectionRequired && (
        <EmptyState
          title="Select an API source"
          subtitle="Choose a source and one of its versions above to browse normalized operations or messages."
        />
      )}

      {artifact && !revision && !selectionRequired && !revisionsLoading && (
        <EmptyState
          title="No browseable version selected"
          subtitle="This source does not have a successful normalized revision available yet."
        />
      )}

      {artifact && revision && artifact.status !== 'link_only' && (
        <section className={styles.catalog} aria-label="Normalized API catalog">
          {!canLoadProjection && (
            <EmptyState
              title="No successful normalized revision"
              subtitle="The latest API source attempt did not produce a browseable revision."
            />
          )}
          {canLoadProjection && projectionQueryResult.isLoading && (
            <LoadingState text="Loading normalized catalog…" />
          )}
          {canLoadProjection && projectionQueryResult.isError && (
            <EmptyState
              title="Normalized catalog unavailable"
              subtitle="The selected revision could not be read."
              action={
                <Button variant="secondary" onClick={() => void projectionQueryResult.refetch()}>
                  Retry
                </Button>
              }
            />
          )}
          {canLoadProjection && projectionQueryResult.data && (
            <>
              <div className={styles.catalogHeader}>
                <div>
                  <div className={sharedStyles.sectionLabel}>
                    {protocolLabel(selectedProtocol)} catalog
                  </div>
                  <div className={styles.catalogTitle}>
                    {projectionQueryResult.data.revision.title ?? 'Untitled specification'}
                  </div>
                  <div className={styles.catalogMeta}>
                    Specification{' '}
                    {projectionQueryResult.data.revision.specificationVersion ??
                      'version unavailable'}
                    {' · '}
                    {projectionQueryResult.data.revision.itemCount} normalized {itemLabel}
                  </div>
                </div>
                <Chip tone="ghost">
                  {projectionQueryResult.data.revision.isCurrent ? 'Current' : 'Historical'}
                  {' · '}
                  {projectionQueryResult.data.revision.revision.sourceRevision ??
                    projectionQueryResult.data.revision.revision.id}
                </Chip>
              </div>
              <RevisionDiagnostics revision={projectionQueryResult.data.revision} />
              <ApiFilters
                protocol={selectedProtocol}
                values={filters}
                onChange={handleFilterChange}
              />
              {items.length === 0 ? (
                <EmptyState
                  title={
                    hasFilters ? `No ${itemLabel} match these filters` : `No ${itemLabel} found`
                  }
                  subtitle={
                    hasFilters
                      ? 'Try clearing one or more filters.'
                      : 'The normalized specification contains no browseable entries.'
                  }
                />
              ) : (
                <div className={styles.items}>
                  {items.map(item => (
                    <ApiItemRow
                      key={item.id}
                      item={item}
                      onOpenRaw={() => setRawOpenRevisionId(item.revisionId)}
                      canViewArtifactContent={canViewArtifactContent}
                    />
                  ))}
                </div>
              )}
              {total > 0 && (
                <div className={styles.pagination}>
                  <span>
                    Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
                    {Math.min(page * PAGE_SIZE, total)} of {total}
                  </span>
                  <div className={styles.paginationActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!hasPreviousPage}
                      onClick={() => onSearchChange({ apiPage: page - 1 }, false)}
                    >
                      Previous
                    </Button>
                    <span>Page {page}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!hasNextPage}
                      onClick={() => onSearchChange({ apiPage: page + 1 }, false)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <UploadApiSpecificationDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={input => uploadApiSpecification.mutateAsync(input)}
        isPending={uploadApiSpecification.isPending}
      />

      <ApiSpecificationSourceDialog
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onCreate={input => createSource.mutateAsync(input)}
        isPending={createSource.isPending}
      />

      <RawSourceDialog
        open={rawOpenRevisionId != null}
        subtitle={rawContentQuery.data?.sourceRevision ?? rawOpenRevisionId ?? undefined}
        isLoading={rawContentQuery.isLoading}
        isError={rawContentQuery.isError}
        content={rawContentQuery.data?.content}
        onClose={() => setRawOpenRevisionId(null)}
      />
    </main>
  );
};
