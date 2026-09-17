import { useMemo } from 'react';
import type {
  ApiSpecificationItem,
  ApiSpecificationProtocol,
  ApiSpecificationRevision,
  Artifact,
  ArtifactStatus
} from '@arch-register/api-types/artifactContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { SearchInput } from '../../../components/SearchInput';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Chip } from '../../../components/Chip';
import {
  getArtifactStatusLabel,
  selectApiSpecificationArtifacts,
  useApiSpecificationProjection,
  useApiSpecificationRevisionLists,
  useEntityArtifacts
} from '../../../hooks/useArtifacts';
import type { ApiSpecificationSourceState } from '../../../hooks/useArtifacts';
import { TbAlertTriangle, TbChevronDown, TbExternalLink, TbRefresh } from 'react-icons/tb';
import styles from '../EntityApiSection.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';

/**
 * The reusable parts of the entity-page API specification viewer (`EntityApiSection.tsx`):
 * source/version picking, revision status/diagnostics, operations/messages filtering and listing,
 * and the raw-source preview dialog. Extracted so the API & Integration Catalog app's spec drawer
 * (#3316) can present the same content outside the entity-detail page's search-param-driven
 * layout, without duplicating this logic. Presentational pieces stay generic (no dependency on
 * `EntityDetailSearchParams`); callers own their own filter/pagination/selection state and pass it
 * in.
 */

export const PAGE_SIZE = 50;

export const cleanFilter = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const protocolLabel = (protocol: ApiSpecificationProtocol | null | undefined) => {
  if (protocol === 'openapi') return 'OpenAPI';
  if (protocol === 'asyncapi') return 'AsyncAPI';
  return 'API specification';
};

export const statusTone = (status: ArtifactStatus) => {
  if (status === 'current') return styles.statusCurrent;
  if (status === 'pending' || status === 'stale') return styles.statusWarning;
  if (status === 'failed' || status === 'invalid' || status === 'unsupported') {
    return styles.statusError;
  }
  return styles.statusNeutral;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const formatJson = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Loads an entity's `api-specification` artifacts and their revision histories. Used both by the
 * entity page and the catalog drawer to build their source/version pickers.
 */
export const useApiSpecificationSources = (workspaceId: string, entityId: string) => {
  const artifactsQuery = useEntityArtifacts(workspaceId, entityId);
  const apiArtifacts = useMemo(
    () => selectApiSpecificationArtifacts(artifactsQuery.data?.artifacts ?? []),
    [artifactsQuery.data?.artifacts]
  );
  const artifactIds = useMemo(() => apiArtifacts.map(artifact => artifact.id), [apiArtifacts]);
  const revisionQueries = useApiSpecificationRevisionLists(
    workspaceId,
    entityId,
    artifactIds,
    !artifactsQuery.isError
  );
  const sources = useMemo(
    () =>
      apiArtifacts.map((artifact, index) => ({
        artifact,
        revisions: revisionQueries[index]?.data ?? []
      })),
    [apiArtifacts, revisionQueries]
  );
  const revisionsLoading = revisionQueries.some(query => query.isPending);
  const revisionsError = revisionQueries.some(query => query.isError);
  return { artifactsQuery, apiArtifacts, sources, revisionsLoading, revisionsError };
};

export type ApiCatalogFilterValues = {
  q?: string;
  resource?: string;
  action?: string;
  tag?: string;
  deprecated?: string;
};

/**
 * Runs the normalized-catalog projection query for a selected artifact/revision, deriving the
 * `operation`/`message` item kind from the revision's detected protocol (falling back to the
 * entity's declared type when no revision has been normalized yet).
 */
export const useApiSpecificationCatalogQuery = (
  workspaceId: string,
  entityId: string,
  artifact: Artifact | undefined,
  revision: ApiSpecificationRevision | undefined,
  declaredType: string | undefined,
  filters: ApiCatalogFilterValues,
  page: number,
  pageSize: number = PAGE_SIZE
) => {
  const protocol = revision?.protocol;
  const kind =
    protocol === 'openapi' || (protocol == null && declaredType === 'openapi')
      ? ('operation' as const)
      : protocol === 'asyncapi' || (protocol == null && declaredType === 'asyncapi')
        ? ('message' as const)
        : undefined;
  const projectionQuery = useMemo(
    () => ({
      q: cleanFilter(filters.q),
      resource: cleanFilter(filters.resource),
      action: cleanFilter(filters.action),
      kind,
      tag: cleanFilter(filters.tag),
      deprecated:
        filters.deprecated === 'true' ? true : filters.deprecated === 'false' ? false : undefined,
      limit: pageSize,
      offset: Math.max(page - 1, 0) * pageSize
    }),
    [
      kind,
      page,
      pageSize,
      filters.q,
      filters.resource,
      filters.action,
      filters.tag,
      filters.deprecated
    ]
  );
  const revisionId = revision?.revision.id ?? '';
  const canLoadProjection = artifact != null && revision != null && artifact.status !== 'link_only';
  const projectionQueryResult = useApiSpecificationProjection(
    workspaceId,
    entityId,
    artifact?.id ?? '',
    revisionId,
    projectionQuery,
    canLoadProjection
  );
  return { projectionQueryResult, canLoadProjection, protocol };
};

const sourceLabel = (source: ApiSpecificationSourceState) => {
  if (source.artifact.location) return source.artifact.location;
  const revision = source.revisions.find(candidate => candidate.isCurrent) ?? source.revisions[0];
  if (revision?.revision.sourceRevision) return revision.revision.sourceRevision;
  return `${source.artifact.kind} source · ${source.artifact.id.slice(0, 8)}`;
};

const revisionLabel = (revision: ApiSpecificationRevision) =>
  [
    revision.isCurrent ? 'Current' : 'Historical',
    revision.specificationVersion ?? 'version unavailable',
    revision.revision.sourceRevision ?? revision.revision.id,
    formatDate(revision.revision.createdAt)
  ].join(' · ');

export const ApiSourceVersionPicker = ({
  sources,
  selectedArtifactId,
  selectedRevisionId,
  revisionsLoading,
  onSelect
}: {
  sources: ApiSpecificationSourceState[];
  selectedArtifactId?: string;
  selectedRevisionId?: string;
  revisionsLoading: boolean;
  onSelect: (artifactId: string, revisionId?: string) => void;
}) => (
  <section className={styles.sourcePicker} aria-label="API specification sources and versions">
    <div className={styles.sourcePickerHeader}>
      <div>
        <div className={sharedStyles.sectionLabel}>Sources and versions</div>
        <div className={styles.sourcePickerHint}>
          Each source keeps its own revision history. Current versions are marked explicitly.
        </div>
      </div>
    </div>
    <div className={styles.sourceList}>
      {sources.map(source => {
        const isSelected = source.artifact.id === selectedArtifactId;
        const currentRevision = source.revisions.find(revision => revision.isCurrent);
        return (
          <div
            key={source.artifact.id}
            className={`${styles.sourceCard} ${isSelected ? styles.sourceCardSelected : ''}`}
          >
            <div className={styles.sourceCardHeader}>
              <button
                type="button"
                className={styles.sourceButton}
                aria-pressed={isSelected}
                onClick={() => onSelect(source.artifact.id, currentRevision?.revision.id)}
              >
                <span className={styles.sourceName}>{sourceLabel(source)}</span>
                <span className={`${styles.status} ${statusTone(source.artifact.status)}`}>
                  {getArtifactStatusLabel(source.artifact.status)}
                </span>
              </button>
              {source.artifact.location && (
                <span className={styles.sourceKind}>{source.artifact.kind}</span>
              )}
            </div>
            <div className={styles.versionList}>
              {revisionsLoading && source.revisions.length === 0 ? (
                <span className={styles.sourceEmpty}>Loading versions…</span>
              ) : source.revisions.length === 0 ? (
                <span className={styles.sourceEmpty}>No accepted revisions</span>
              ) : (
                source.revisions.map(revision => {
                  const isVersionSelected =
                    isSelected && revision.revision.id === selectedRevisionId;
                  return (
                    <button
                      type="button"
                      key={revision.revision.id}
                      className={`${styles.versionButton} ${
                        isVersionSelected ? styles.versionButtonSelected : ''
                      }`}
                      aria-pressed={isVersionSelected}
                      onClick={() => onSelect(source.artifact.id, revision.revision.id)}
                    >
                      <span className={styles.versionLabel}>{revisionLabel(revision)}</span>
                      <span className={`${styles.versionStatus} ${statusTone(revision.status)}`}>
                        {getArtifactStatusLabel(revision.status)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export const RevisionDiagnostics = ({ revision }: { revision: ApiSpecificationRevision }) => {
  if (revision.diagnostics.length === 0) return null;
  return (
    <div className={`${styles.notice} ${styles.noticeWarning} ${styles.catalogNotice}`}>
      <TbAlertTriangle size={13} />
      <div>
        <div>
          {revision.diagnostics.length} normalization diagnostic
          {revision.diagnostics.length === 1 ? '' : 's'} are attached to this revision.
        </div>
        <ul className={styles.diagnosticList}>
          {revision.diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${diagnostic.source?.pointer ?? ''}-${index}`}>
              <strong>{diagnostic.code}</strong>: {diagnostic.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const StatusNotice = ({
  status,
  revision
}: {
  status: ArtifactStatus;
  revision: ApiSpecificationRevision | undefined;
}) => {
  if (status === 'link_only') {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        <TbExternalLink size={13} />
        This API is linked to an external source; no local normalized operations are available.
      </div>
    );
  }

  if (!revision) {
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
        No successful normalized revision is available for the selected source.
      </div>
    );
  }

  if (!revision.isCurrent) {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        <TbAlertTriangle size={13} />
        Showing a historical revision. The source&apos;s current version remains unchanged.
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={`${styles.notice} ${styles.noticeInfo}`}>
        <TbRefresh size={13} />
        The source is being processed; the selected current revision remains browseable.
      </div>
    );
  }

  if (status !== 'current' && status !== 'not_configured') {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        <TbAlertTriangle size={13} />
        This catalog is showing the last successful revision. It is not current because the latest
        source attempt is {getArtifactStatusLabel(status).toLowerCase()}.
      </div>
    );
  }

  return null;
};

export const ApiFilters = ({
  protocol,
  values,
  onChange
}: {
  protocol: ApiSpecificationProtocol | null | undefined;
  values: ApiCatalogFilterValues;
  onChange: (patch: Partial<ApiCatalogFilterValues>) => void;
}) => {
  const resourceLabel = protocol === 'asyncapi' ? 'Channel' : 'Path';
  const actionLabel = protocol === 'asyncapi' ? 'Action' : 'Method';
  const actions =
    protocol === 'asyncapi'
      ? ['publish', 'subscribe', 'send', 'receive']
      : ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

  return (
    <fieldset className={styles.filters}>
      <legend className={styles.filterLegend}>API catalog filters</legend>
      <SearchInput
        value={values.q ?? ''}
        onChange={value => onChange({ q: value === '' ? undefined : value })}
        onClear={() => onChange({ q: undefined })}
        placeholder="Search identifier, summary, path or channel"
        size="sm"
        aria-label="Search API catalog"
      />
      <input
        className={styles.filterInput}
        value={values.resource ?? ''}
        onChange={event =>
          onChange({ resource: event.target.value.length > 0 ? event.target.value : undefined })
        }
        placeholder={resourceLabel}
        aria-label={resourceLabel}
      />
      <select
        className={styles.filterSelect}
        value={values.action ?? ''}
        onChange={event =>
          onChange({ action: event.target.value.length > 0 ? event.target.value : undefined })
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
        value={values.tag ?? ''}
        onChange={event =>
          onChange({ tag: event.target.value.length > 0 ? event.target.value : undefined })
        }
        placeholder="Tag"
        aria-label="Tag"
      />
      <select
        className={styles.filterSelect}
        value={values.deprecated ?? ''}
        onChange={event =>
          onChange({
            deprecated:
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

export const DetailBlock = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.detailBlock}>
    <div className={styles.detailLabel}>{label}</div>
    <pre>{value}</pre>
  </div>
);

export const ItemDetails = ({ item }: { item: ApiSpecificationItem }) => {
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

export const ApiItemRow = ({
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

/**
 * The raw-source preview modal opened from an `ApiItemRow`'s "View source" action.
 */
export const RawSourceDialog = ({
  open,
  subtitle,
  isLoading,
  isError,
  content,
  onClose
}: {
  open: boolean;
  subtitle?: string;
  isLoading: boolean;
  isError: boolean;
  content: string | undefined;
  onClose: () => void;
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Raw API source"
    sub={subtitle}
    width="min(960px, 90vw)"
    buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
  >
    {isLoading ? (
      <LoadingState text="Loading source…" />
    ) : isError ? (
      <EmptyState
        title="Raw source unavailable"
        subtitle="You may no longer have permission to view this source."
      />
    ) : (
      <pre className={styles.rawContent}>{content ?? 'No source content returned.'}</pre>
    )}
  </Dialog>
);
