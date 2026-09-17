import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { useEntityTypedRelations } from '../../../hooks/useRelations';
import { entityDetailQuery } from '../../../queries/entities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import {
  resolveApiSpecificationSelection,
  useArtifactRevisionContent
} from '../../../hooks/useArtifacts';
import {
  ApiFilters,
  ApiItemRow,
  ApiSourceVersionPicker,
  PAGE_SIZE,
  RawSourceDialog,
  RevisionDiagnostics,
  StatusNotice,
  useApiSpecificationCatalogQuery,
  useApiSpecificationSources
} from '../../../sections/entities/components/ApiSpecificationCatalog';
import type { ApiCatalogFilterValues } from '../../../sections/entities/components/ApiSpecificationCatalog';
import { apiFieldValue, apiFieldValues } from '../apiFieldDisplay';
import styles from './ApiSpecDrawer.module.css';

const PROVIDERS_FIELD = 'providers';
const CONSUMERS_FIELD = 'consumers';

/**
 * The shared API specification drawer ("ICSpecDrawer" in the approved design): source/version
 * picker, revision status, normalized operations/messages with filtering and raw-source preview
 * (all via `ApiSpecificationCatalog`, shared with the entity-detail page's `EntityApiSection`),
 * plus provider/consumer context via the `Provides API` / `Consumes API` typed relations on the
 * `api` schema's own `providers`/`consumers` fields. Deep-linkable from the APIs list
 * (`api-integration-catalog/apis/$apiId`) and reusable from other sections that link into a spec
 * (#3317, #3318).
 */
export const ApiSpecDrawer = ({
  workspaceSlug,
  apiId,
  apiSchemaId,
  onClose
}: {
  workspaceSlug: string;
  apiId: string;
  apiSchemaId: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { canViewArtifactContent } = useWorkspaceAuthorization(workspaceSlug);
  const api = useQuery(entityDetailQuery(workspaceSlug, apiId));
  const uid = api.data?._uid ?? null;
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiSchemaId);

  const providersField = apiSchema?.fields.find(field => field.id === PROVIDERS_FIELD);
  const providersRelationSchemaId =
    providersField?.type === 'typedRelation' ? providersField.relationSchemaId : null;
  const consumersField = apiSchema?.fields.find(field => field.id === CONSUMERS_FIELD);
  const consumersRelationSchemaId =
    consumersField?.type === 'typedRelation' ? consumersField.relationSchemaId : null;

  const relations = useEntityTypedRelations(workspaceSlug, uid ?? '');
  const allRelations = [...(relations.data?.outgoing ?? []), ...(relations.data?.incoming ?? [])];
  const providers = allRelations.filter(
    relation => relation._schema.id === providersRelationSchemaId
  );
  const consumers = allRelations.filter(
    relation => relation._schema.id === consumersRelationSchemaId
  );
  const otherEndpoint = (relation: (typeof allRelations)[number]) =>
    relation._in.id === uid ? relation._out : relation._in;

  const { artifactsQuery, apiArtifacts, sources, revisionsLoading, revisionsError } =
    useApiSpecificationSources(workspaceSlug, uid ?? '');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>(undefined);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const selection = resolveApiSpecificationSelection(
    sources,
    selectedArtifactId,
    selectedRevisionId
  );
  const artifact = selection.artifact;
  const revision = selection.revision;

  const [filters, setFilters] = useState<ApiCatalogFilterValues>({});
  const [page, setPage] = useState(1);
  const handleFilterChange = (patch: Partial<ApiCatalogFilterValues>) => {
    setFilters(previous => ({ ...previous, ...patch }));
    setPage(1);
  };
  const handleSourceSelection = (artifactId: string, revisionId?: string) => {
    setSelectedArtifactId(artifactId);
    setSelectedRevisionId(revisionId);
    setPage(1);
  };

  const declaredType = typeof api.data?.api_type === 'string' ? api.data.api_type : undefined;
  const { projectionQueryResult, canLoadProjection, protocol } = useApiSpecificationCatalogQuery(
    workspaceSlug,
    uid ?? '',
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
    workspaceSlug,
    uid ?? '',
    artifact?.id ?? '',
    rawOpenRevisionId ?? '',
    rawOpenRevisionId != null && canViewArtifactContent
  );

  if (api.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading API…</div>
      </Drawer>
    );
  }
  if (api.isError || !api.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This API is unavailable.</div>
      </Drawer>
    );
  }

  const entity = api.data;
  const status = artifact?.status ?? 'not_configured';
  const selectedProtocol = projectionQueryResult.data?.revision.protocol ?? protocol;
  const items = projectionQueryResult.data?.items ?? [];
  const itemLabel = selectedProtocol === 'asyncapi' ? 'messages' : 'operations';
  const selectionRequired = apiArtifacts.length > 1 && artifact == null;

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        <>
          {apiFieldValues(apiSchema, entity, 'protocols').map(value => (
            <Chip key={value} tone="ghost">
              {value}
            </Chip>
          ))}
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </>
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Attributes</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>API version</span>
        <span>{apiFieldValue(apiSchema, entity, 'api_version')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{entity._owner?.name ?? '—'}</span>
      </div>

      <div className={styles.sectionLabel}>Providers</div>
      {providers.length === 0 ? (
        <span className="dim">No entities provide this API.</span>
      ) : (
        providers.map(relation => (
          <div className={styles.attributeRow} key={relation._uid}>
            <span>{otherEndpoint(relation).name}</span>
          </div>
        ))
      )}

      <div className={styles.sectionLabel}>Consumers</div>
      {consumers.length === 0 ? (
        <span className="dim">No entities consume this API.</span>
      ) : (
        consumers.map(relation => (
          <div className={styles.attributeRow} key={relation._uid}>
            <span>{otherEndpoint(relation).name}</span>
          </div>
        ))
      )}

      <div className={styles.sectionLabel}>Specification</div>
      <div className={styles.catalogPane}>
        {artifactsQuery.isLoading && <LoadingState text="Loading API catalog…" />}
        {artifactsQuery.isError && (
          <EmptyState
            title="API catalog unavailable"
            subtitle="The API artifact metadata could not be loaded."
          />
        )}
        {!artifactsQuery.isLoading && !artifactsQuery.isError && apiArtifacts.length === 0 && (
          <EmptyState
            title="No API specification configured"
            subtitle="This API has no source attached yet."
          />
        )}
        {!artifactsQuery.isLoading && !artifactsQuery.isError && apiArtifacts.length > 0 && (
          <>
            <ApiSourceVersionPicker
              sources={sources}
              selectedArtifactId={artifact?.id}
              selectedRevisionId={revision?.revision.id}
              revisionsLoading={revisionsLoading}
              onSelect={handleSourceSelection}
            />
            {revisionsError && (
              <EmptyState
                title="Version history unavailable"
                subtitle="One or more source version histories could not be loaded."
              />
            )}
            {artifact && <StatusNotice status={status} revision={revision} />}
            {selectionRequired && (
              <EmptyState
                title="Select an API source"
                subtitle="Choose a source and one of its versions above to browse normalized operations or messages."
              />
            )}
            {artifact && revision && artifact.status !== 'link_only' && (
              <>
                {canLoadProjection && projectionQueryResult.isLoading && (
                  <LoadingState text="Loading normalized catalog…" />
                )}
                {canLoadProjection && projectionQueryResult.isError && (
                  <EmptyState
                    title="Normalized catalog unavailable"
                    subtitle="The selected revision could not be read."
                  />
                )}
                {canLoadProjection && projectionQueryResult.data && (
                  <>
                    <ApiFilters
                      protocol={selectedProtocol}
                      values={filters}
                      onChange={handleFilterChange}
                    />
                    <RevisionDiagnostics revision={projectionQueryResult.data.revision} />
                    {items.length === 0 ? (
                      <EmptyState
                        title={`No ${itemLabel} found`}
                        subtitle="The normalized specification contains no browseable entries."
                      />
                    ) : (
                      items.map(item => (
                        <ApiItemRow
                          key={item.id}
                          item={item}
                          onOpenRaw={() => setRawOpenRevisionId(item.revisionId)}
                          canViewArtifactContent={canViewArtifactContent}
                        />
                      ))
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <RawSourceDialog
        open={rawOpenRevisionId != null}
        subtitle={rawContentQuery.data?.sourceRevision ?? rawOpenRevisionId ?? undefined}
        isLoading={rawContentQuery.isLoading}
        isError={rawContentQuery.isError}
        content={rawContentQuery.data?.content}
        onClose={() => setRawOpenRevisionId(null)}
      />
    </Drawer>
  );
};
