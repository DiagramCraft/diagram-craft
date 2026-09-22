import { useEffect, useState } from 'react';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId
} from '@arch-register/api-types/integrationCatalog';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useWorkspaceCapabilityConfigurations } from '../../../hooks/useWorkspaceConfig';
import {
  resolveApiSpecificationSelection,
  useArtifactRevisionContent
} from '../../../hooks/useArtifacts';
import {
  ApiItemRow,
  ApiSourceVersionPicker,
  PAGE_SIZE,
  RawSourceDialog,
  RevisionDiagnostics,
  StatusNotice,
  useApiSpecificationCatalogQuery,
  useApiSpecificationSources
} from '../../../sections/entities/components/ApiSpecificationCatalog';
import {
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import styles from './ApiSpecDrawer.module.css';

const API_SLOT_ID = 'api-specification.catalog';

const supportsApiSpecificationSchema = (context: EntityDrawerProviderContext): boolean => {
  const requiredFieldIds = ['protocols', 'providers', 'consumers'];
  return requiredFieldIds.every(fieldId =>
    context.schema.fields.some(field => field.id === fieldId)
  );
};

const declaredApiType = (
  context: EntityDrawerProviderContext,
  capabilityConfigurations: ReturnType<typeof useWorkspaceCapabilityConfigurations>['data']
) => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === 'api-specification'
  );
  const binding = configuration?.bindings.api;
  const definition = getWorkspaceCapabilityDefinition('api-specification');
  const role = definition?.bindingRoles
    .find(candidate => candidate.id === 'api')
    ?.fieldRoles.find(candidate => candidate.id === 'api_type');
  const fieldId = binding && role ? resolveCapabilityFieldId(binding, role) : 'api_type';
  const value = context.entity[fieldId];
  return typeof value === 'string' ? value : undefined;
};

const ApiSpecificationCatalogProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
  const { canViewArtifactContent } = useWorkspaceAuthorization(context.workspaceId);
  const capabilityConfigurations = useWorkspaceCapabilityConfigurations(context.workspaceId);
  const { artifactsQuery, apiArtifacts, sources, revisionsLoading, revisionsError } =
    useApiSpecificationSources(context.workspaceId, context.entity._uid);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>(undefined);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const selection = resolveApiSpecificationSelection(
    sources,
    selectedArtifactId,
    selectedRevisionId
  );
  const artifact = selection.artifact;
  const revision = selection.revision;
  const [page, setPage] = useState(1);
  const [rawOpenRevisionId, setRawOpenRevisionId] = useState<string | null>(null);

  const handleSourceSelection = (artifactId: string, revisionId?: string) => {
    setSelectedArtifactId(artifactId);
    setSelectedRevisionId(revisionId);
    setPage(1);
  };

  const declaredType = declaredApiType(context, capabilityConfigurations.data);
  const { projectionQueryResult, canLoadProjection, protocol } = useApiSpecificationCatalogQuery(
    context.workspaceId,
    context.entity._uid,
    artifact,
    revision,
    declaredType,
    {},
    page,
    PAGE_SIZE
  );
  const rawSelectionKey = `${artifact?.id ?? ''}:${revision?.revision.id ?? ''}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when the selected source or revision changes
  useEffect(() => {
    setRawOpenRevisionId(null);
  }, [rawSelectionKey]);

  const rawContentQuery = useArtifactRevisionContent(
    context.workspaceId,
    context.entity._uid,
    artifact?.id ?? '',
    rawOpenRevisionId ?? '',
    rawOpenRevisionId != null && canViewArtifactContent
  );

  const selectedProtocol = projectionQueryResult.data?.revision.protocol ?? protocol;
  const items = projectionQueryResult.data?.items ?? [];
  const itemLabel = selectedProtocol === 'asyncapi' ? 'messages' : 'operations';
  const status = artifact?.status ?? 'not_configured';
  const selectionRequired = apiArtifacts.length > 1 && artifact == null;

  return (
    <div className={styles.catalogPane}>
      {showLabel !== false && <div className={styles.sectionLabel}>{label}</div>}
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
      <RawSourceDialog
        open={rawOpenRevisionId != null}
        subtitle={rawContentQuery.data?.sourceRevision ?? rawOpenRevisionId ?? undefined}
        isLoading={rawContentQuery.isLoading}
        isError={rawContentQuery.isError}
        content={rawContentQuery.data?.content}
        onClose={() => setRawOpenRevisionId(null)}
      />
    </div>
  );
};

export const apiEntityDrawerProviderDefinitions = [
  {
    slotId: API_SLOT_ID,
    supports: supportsApiSpecificationSchema,
    Component: ApiSpecificationCatalogProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
