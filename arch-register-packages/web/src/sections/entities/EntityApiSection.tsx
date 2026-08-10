import { useEffect, useMemo, useState } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import type {
  ApiSpecificationItem,
  ApiSpecificationProtocol,
  ArtifactStatus
} from '@arch-register/api-types/artifactContract';
import {
  getEntityCapabilityDefinition,
  resolveEntityCapabilityFieldId
} from '@arch-register/api-types/integrationCatalog';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { SearchInput } from '../../components/SearchInput';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Chip } from '../../components/Chip';
import { EntityNavigationLink } from '../../components/EntityNavigationLink';
import { getRelationDisplayLabel } from '../../lib/entityRelations';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import {
  getArtifactStatusLabel,
  selectApiSpecificationArtifact,
  selectApiSpecificationArtifacts,
  useApiSpecificationProjection,
  useCreateApiSpecificationSource,
  useArtifactRevisionContent,
  useEntityArtifacts,
  useRefreshApiSpecification,
  useUploadApiSpecification
} from '../../hooks/useArtifacts';
import { ApiSpecificationSourceDialog } from './ApiSpecificationSourceDialog';
import { UploadApiSpecificationDialog } from './UploadApiSpecificationDialog';
import type { Relation } from './types/entityDetailTypes';
import type { EntityDetailSearchParams } from '../../routes/searchParams';
import styles from './EntityApiSection.module.css';
import sharedStyles from './EntityDetailScreen.module.css';
import {
  TbAlertTriangle,
  TbChevronDown,
  TbExternalLink,
  TbLink,
  TbRefresh,
  TbUpload
} from 'react-icons/tb';

const PAGE_SIZE = 50;

type Props = {
  workspaceId: string;
  entity: EntityRecord;
  entityCapability?: EntityCapability;
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
  capability: EntityCapability,
  roleId: string
) => {
  const definition = getEntityCapabilityDefinition(capability.type);
  const role = definition?.fieldRoles.find(candidate => candidate.id === roleId);
  return readStringField(entity, role ? resolveEntityCapabilityFieldId(capability, role) : roleId);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatJson = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const cleanFilter = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
};

const protocolLabel = (protocol: ApiSpecificationProtocol | null | undefined) => {
  if (protocol === 'openapi') return 'OpenAPI';
  if (protocol === 'asyncapi') return 'AsyncAPI';
  return 'API specification';
};

const statusTone = (status: ArtifactStatus) => {
  if (status === 'current') return styles.statusCurrent;
  if (status === 'pending' || status === 'stale') return styles.statusWarning;
  if (status === 'failed' || status === 'invalid' || status === 'unsupported') {
    return styles.statusError;
  }
  return styles.statusNeutral;
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
  capability,
  artifact,
  protocol,
  sourceCount,
  canManageArtifacts,
  isRefreshing,
  onRefresh
}: {
  entity: EntityRecord;
  capability: EntityCapability;
  artifact: ReturnType<typeof selectApiSpecificationArtifact> | undefined;
  protocol: ApiSpecificationProtocol | null | undefined;
  sourceCount: number;
  canManageArtifacts: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) => {
  const declaredType = readMappedStringField(entity, capability, 'api_type');
  const declaredVersion = readMappedStringField(entity, capability, 'api_version');

  return (
    <section className={styles.metadata} aria-label="API specification metadata">
      <div className={styles.metadataHeader}>
        <div>
          <div className={styles.eyebrow}>API catalog</div>
          <h2 className={styles.title}>{entity._name ?? entity._slug}</h2>
        </div>
        <div className={`${styles.status} ${statusTone(artifact?.status ?? 'not_configured')}`}>
          {getArtifactStatusLabel(artifact?.status ?? 'not_configured')}
        </div>
      </div>
      <div className={styles.metadataGrid}>
        <MetadataItem label="Declared type" value={declaredType ?? 'Not set'} />
        <MetadataItem label="API version" value={declaredVersion ?? 'Not set'} />
        <MetadataItem label="Protocol" value={protocolLabel(protocol)} />
        <MetadataItem label="Source kind" value={artifact?.kind ?? 'Not configured'} />
        <MetadataItem label="Media type" value={artifact?.mediaType ?? 'Not available'} />
        <MetadataItem label="Last attempt" value={formatDate(artifact?.lastAttemptAt)} />
        <MetadataItem label="Last success" value={formatDate(artifact?.lastSuccessAt)} />
        <MetadataItem
          label="Revision"
          value={artifact?.currentRevisionId ? artifact.currentRevisionId : 'None'}
        />
      </div>
      {sourceCount > 1 && (
        <div className={styles.sourceNotice}>
          <TbAlertTriangle size={13} />
          Multiple API sources are attached; showing the most recently updated source.
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

const ApiFilters = ({
  protocol,
  search,
  onSearchChange
}: {
  protocol: ApiSpecificationProtocol | null | undefined;
  search: EntityDetailSearchParams;
  onSearchChange: Props['onSearchChange'];
}) => {
  const resourceLabel = protocol === 'asyncapi' ? 'Channel' : 'Path';
  const actionLabel = protocol === 'asyncapi' ? 'Action' : 'Method';
  const actions =
    protocol === 'asyncapi'
      ? ['publish', 'subscribe', 'send', 'receive']
      : ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

  const updateFilter = (patch: Partial<EntityDetailSearchParams>) =>
    onSearchChange({ ...patch, apiPage: undefined }, true);

  return (
    <fieldset className={styles.filters}>
      <legend className={styles.filterLegend}>API catalog filters</legend>
      <SearchInput
        value={search.apiQ ?? ''}
        onChange={value => updateFilter({ apiQ: value === '' ? undefined : value })}
        onClear={() => updateFilter({ apiQ: undefined })}
        placeholder="Search identifier, summary, path or channel"
        size="sm"
        aria-label="Search API catalog"
      />
      <input
        className={styles.filterInput}
        value={search.apiResource ?? ''}
        onChange={event =>
          updateFilter({
            apiResource: event.target.value.length > 0 ? event.target.value : undefined
          })
        }
        placeholder={resourceLabel}
        aria-label={resourceLabel}
      />
      <select
        className={styles.filterSelect}
        value={search.apiAction ?? ''}
        onChange={event =>
          updateFilter({
            apiAction: event.target.value.length > 0 ? event.target.value : undefined
          })
        }
        aria-label={actionLabel}
      >
        <option value="">All {actionLabel.toLowerCase()}s</option>
        {actions.map(action => (
          <option key={action} value={action}>
            {action.toUpperCase()}
          </option>
        ))}
      </select>
      <input
        className={styles.filterInput}
        value={search.apiTag ?? ''}
        onChange={event =>
          updateFilter({ apiTag: event.target.value.length > 0 ? event.target.value : undefined })
        }
        placeholder="Tag"
        aria-label="Tag"
      />
      <select
        className={styles.filterSelect}
        value={search.apiDeprecated ?? ''}
        onChange={event =>
          updateFilter({
            apiDeprecated:
              event.target.value === 'true' || event.target.value === 'false'
                ? event.target.value
                : undefined
          })
        }
        aria-label="Deprecated"
      >
        <option value="">All statuses</option>
        <option value="false">Current only</option>
        <option value="true">Deprecated only</option>
      </select>
    </fieldset>
  );
};

const ItemDetails = ({ item }: { item: ApiSpecificationItem }) => {
  const input = formatJson(item.input);
  const output = formatJson(item.output);
  const parameters = item.parameters.length > 0 ? formatJson(item.parameters) : null;

  return (
    <div className={styles.itemDetails}>
      {item.description && <p className={styles.description}>{item.description}</p>}
      <div className={styles.detailGrid}>
        {parameters && <DetailBlock label="Parameters" value={parameters} />}
        {input && <DetailBlock label="Input" value={input} />}
        {output && <DetailBlock label="Output" value={output} />}
        {Object.keys(item.metadata).length > 0 && (
          <DetailBlock label="Metadata" value={formatJson(item.metadata) ?? ''} />
        )}
      </div>
    </div>
  );
};

const DetailBlock = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.detailBlock}>
    <div className={styles.detailLabel}>{label}</div>
    <pre>{value}</pre>
  </div>
);

const ApiItemRow = ({
  item,
  onOpenRaw,
  canViewArtifactContent
}: {
  item: ApiSpecificationItem;
  onOpenRaw: () => void;
  canViewArtifactContent: boolean;
}) => (
  <details className={styles.item}>
    <summary>
      <span className={styles.itemAction}>{item.action.toUpperCase()}</span>
      <span className={styles.itemResource}>
        {item.path ?? item.channel ?? 'Unspecified resource'}
      </span>
      <span className={styles.itemIdentifier}>{item.identifier}</span>
      {item.deprecated && <Chip tone="ghost">Deprecated</Chip>}
      <TbChevronDown className={styles.itemChevron} size={14} />
    </summary>
    <div className={styles.itemBody}>
      {item.summary && <div className={styles.itemSummary}>{item.summary}</div>}
      <div className={styles.itemMeta}>
        {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
        <span>
          Source: {item.source.pointer}
          {item.source.line != null ? ` · line ${item.source.line}` : ''}
        </span>
        {canViewArtifactContent ? (
          <Button variant="ghost" size="xs" onClick={onOpenRaw}>
            View source
          </Button>
        ) : (
          <span className={styles.restricted}>Source restricted</span>
        )}
      </div>
      <ItemDetails item={item} />
    </div>
  </details>
);

const StatusNotice = ({
  status,
  hasRevision
}: {
  status: ArtifactStatus;
  hasRevision: boolean;
}) => {
  if (status === 'current' || status === 'not_configured') return null;

  if (hasRevision && status !== 'link_only' && status !== 'pending') {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        <TbAlertTriangle size={13} />
        This catalog is showing the last successful revision. It is not current because the latest
        source attempt is {getArtifactStatusLabel(status).toLowerCase()}.
      </div>
    );
  }

  if (status === 'link_only') {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        <TbExternalLink size={13} />
        This API is linked to an external source; no local normalized operations are available.
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        <TbRefresh size={13} />
        The API source is being processed. Normalized operations will appear after ingestion.
      </div>
    );
  }

  return (
    <div className={`${styles.notice} ${styles.noticeError}`}>
      <TbAlertTriangle size={13} />
      No successful normalized revision is available.
    </div>
  );
};

export const EntityApiSection = ({
  workspaceId,
  entity,
  entityCapability,
  outgoing,
  incoming,
  search,
  onSearchChange
}: Props) => {
  const capability = entityCapability ?? { type: 'api-specification' };
  const { canManageArtifacts, canViewArtifactContent } = useWorkspaceAuthorization(workspaceId);
  const canManageApiArtifacts = canManageArtifacts && entity.canEdit;
  const artifactsQuery = useEntityArtifacts(workspaceId, entity._uid);
  const createSource = useCreateApiSpecificationSource(workspaceId, entity._uid);
  const refreshApiSpecification = useRefreshApiSpecification(workspaceId, entity._uid);
  const uploadApiSpecification = useUploadApiSpecification(workspaceId, entity._uid);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const apiArtifacts = useMemo(
    () => selectApiSpecificationArtifacts(artifactsQuery.data?.artifacts ?? []),
    [artifactsQuery.data?.artifacts]
  );
  const artifact = apiArtifacts[0];
  const revisionId = artifact?.currentRevisionId ?? '';
  const declaredType = readMappedStringField(entity, capability, 'api_type');
  const kind =
    declaredType === 'openapi'
      ? ('operation' as const)
      : declaredType === 'asyncapi'
        ? ('message' as const)
        : undefined;
  const page = search.apiPage ?? 1;
  const projectionQuery = useMemo(
    () => ({
      q: cleanFilter(search.apiQ),
      resource: cleanFilter(search.apiResource),
      action: cleanFilter(search.apiAction),
      kind,
      tag: cleanFilter(search.apiTag),
      deprecated:
        search.apiDeprecated === 'true'
          ? true
          : search.apiDeprecated === 'false'
            ? false
            : undefined,
      limit: PAGE_SIZE,
      offset: Math.max(page - 1, 0) * PAGE_SIZE
    }),
    [
      kind,
      page,
      search.apiAction,
      search.apiDeprecated,
      search.apiQ,
      search.apiResource,
      search.apiTag
    ]
  );
  const canLoadProjection =
    artifact != null &&
    revisionId.length > 0 &&
    artifact.status !== 'link_only' &&
    artifact.status !== 'pending';
  const projectionQueryResult = useApiSpecificationProjection(
    workspaceId,
    entity._uid,
    artifact?.id ?? '',
    revisionId,
    projectionQuery,
    canLoadProjection
  );
  const [rawOpenRevisionId, setRawOpenRevisionId] = useState<string | null>(null);
  const rawSelectionKey = `${artifact?.id ?? ''}:${revisionId}`;
  useEffect(() => {
    if (rawSelectionKey) setRawOpenRevisionId(null);
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
  const protocol = projectionQueryResult.data?.revision.protocol;
  const total = projectionQueryResult.data?.total ?? 0;
  const items = projectionQueryResult.data?.items ?? [];
  const itemLabel = protocol === 'asyncapi' ? 'messages' : 'operations';
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

  return (
    <main className={styles.page}>
      <ApiMetadata
        entity={entity}
        capability={capability}
        artifact={artifact}
        protocol={protocol}
        sourceCount={apiArtifacts.length}
        canManageArtifacts={canManageApiArtifacts}
        isRefreshing={refreshApiSpecification.isPending}
        onRefresh={() => {
          if (artifact) void refreshApiSpecification.mutateAsync(artifact.id);
        }}
      />
      <ApiContext
        entityName={entity._name ?? entity._slug}
        outgoing={outgoing}
        incoming={incoming}
      />
      <StatusNotice status={status} hasRevision={revisionId.length > 0} />

      {status === 'not_configured' && (
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

      {status !== 'not_configured' && status !== 'link_only' && status !== 'pending' && (
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
                  <div className={sharedStyles.sectionLabel}>{protocolLabel(protocol)} catalog</div>
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
                  Revision{' '}
                  {projectionQueryResult.data.revision.revision.sourceRevision ??
                    projectionQueryResult.data.revision.revision.id}
                </Chip>
              </div>
              {projectionQueryResult.data.revision.diagnostics.length > 0 && (
                <div className={`${styles.notice} ${styles.noticeWarning} ${styles.catalogNotice}`}>
                  <TbAlertTriangle size={13} />
                  <span>
                    {projectionQueryResult.data.revision.diagnostics.length} normalization
                    diagnostic
                    {projectionQueryResult.data.revision.diagnostics.length === 1 ? '' : 's'} are
                    attached to this revision.
                  </span>
                </div>
              )}
              <ApiFilters protocol={protocol} search={search} onSearchChange={onSearchChange} />
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

      <Dialog
        open={rawOpenRevisionId != null}
        onClose={() => setRawOpenRevisionId(null)}
        title="Raw API source"
        sub={rawContentQuery.data?.sourceRevision ?? rawOpenRevisionId ?? undefined}
        width="min(960px, 90vw)"
        buttons={[{ label: 'Close', type: 'cancel', onClick: () => setRawOpenRevisionId(null) }]}
      >
        {rawContentQuery.isLoading ? (
          <LoadingState text="Loading source…" />
        ) : rawContentQuery.isError ? (
          <EmptyState
            title="Raw source unavailable"
            subtitle="You may no longer have permission to view this source."
          />
        ) : (
          <pre className={styles.rawContent}>
            {rawContentQuery.data?.content ?? 'No source content returned.'}
          </pre>
        )}
      </Dialog>
    </main>
  );
};
