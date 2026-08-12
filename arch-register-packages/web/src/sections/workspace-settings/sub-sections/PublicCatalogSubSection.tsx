import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  PublicCatalogConfig,
  PublicCatalogPreview,
  PublicCatalogSelectorOptions
} from '@arch-register/api-types/publicCatalogContract';
import {
  usePreviewPublicCatalogConfig,
  usePublicCatalogConfig,
  usePublicCatalogSelectorOptions,
  useUpdatePublicCatalogConfig
} from '../../../hooks/usePublicCatalogConfig';
import {
  normalizePublicPath,
  publicPathFromNodePath,
  selectorArtifactById,
  selectorEntityByIdentifier,
  isDraftEntityPublished,
  validatePublicCatalogDraft
} from './PublicCatalogSubSection.helpers';
import styles from './LifecycleSubSection.module.css';

const emptyConfig: PublicCatalogConfig = {
  enabled: false,
  title: undefined,
  description: undefined,
  indexable: false,
  schemas: [],
  entityOverrides: [],
  pages: [],
  apiArtifacts: []
};

const selectStyle: CSSProperties = {
  maxWidth: 520,
  minHeight: 30,
  padding: '4px 8px',
  border: '1px solid var(--panel-border)',
  borderRadius: 4,
  background: 'var(--panel-bg)',
  color: 'var(--base-fg)'
};

const cardStyle: CSSProperties = {
  padding: 12,
  border: '1px solid var(--panel-border)',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 10
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const mutedStyle: CSSProperties = { color: 'var(--cmp-fg-disabled)', fontSize: 12 };
const errorStyle: CSSProperties = { color: 'var(--error-fg, #d55)', fontSize: 12 };

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Invalid public catalog configuration';

const configWithoutTimestamp = (value: PublicCatalogConfig) => ({
  enabled: value.enabled,
  title: value.title,
  description: value.description,
  indexable: value.indexable,
  schemas: value.schemas,
  entityOverrides: value.entityOverrides,
  pages: value.pages,
  apiArtifacts: value.apiArtifacts
});

const normalizeConfigForSubmit = (value: PublicCatalogConfig): PublicCatalogConfig => ({
  ...value,
  title: value.title?.trim() || undefined,
  description: value.description?.trim() || undefined,
  pages: value.pages.map((page, index) => ({
    ...page,
    publicPath: normalizePublicPath(page.publicPath),
    label: page.label?.trim() || undefined,
    order: index
  }))
});

const InlineErrors = ({ errors }: { errors: string[] | undefined }) =>
  errors && errors.length > 0 ? (
    <div role="alert" style={errorStyle}>
      {errors.map(error => (
        <div key={error}>{error}</div>
      ))}
    </div>
  ) : null;

const entityLabel = (entity: PublicCatalogSelectorOptions['entities'][number]) =>
  `${entity.name} · ${entity.schemaName}`;

const revisionLabel = (
  revision: PublicCatalogSelectorOptions['apiArtifacts'][number]['revisions'][number]
) =>
  revision.title ??
  revision.specificationVersion ??
  revision.revision.sourceRevision ??
  revision.revision.id;

export const PublicCatalogSubSection = ({
  workspaceSlug,
  schemas
}: {
  workspaceSlug: string;
  schemas: Array<{
    id: string;
    name: string;
    fields: Array<{ id: string; name: string; type: string }>;
  }>;
}) => {
  const {
    data,
    isLoading: configLoading,
    isError: configError
  } = usePublicCatalogConfig(workspaceSlug);
  const {
    data: selectorOptions,
    isLoading: optionsLoading,
    isError: optionsError
  } = usePublicCatalogSelectorOptions(workspaceSlug);
  const update = useUpdatePublicCatalogConfig(workspaceSlug);
  const previewMutation = usePreviewPublicCatalogConfig(workspaceSlug);
  const [config, setConfig] = useState<PublicCatalogConfig>(emptyConfig);
  const [savedConfig, setSavedConfig] = useState<PublicCatalogConfig>(emptyConfig);
  const [preview, setPreview] = useState<PublicCatalogPreview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const fallbackOptions = useMemo<PublicCatalogSelectorOptions>(
    () => ({
      schemas: schemas.map(schema => ({
        id: schema.id,
        name: schema.name,
        description: '',
        keyPrefix: '',
        fields: schema.fields.map(field => ({ ...field, selectable: true }))
      })),
      entities: [],
      pages: [],
      apiArtifacts: []
    }),
    [schemas]
  );
  const options = selectorOptions ?? fallbackOptions;

  useEffect(() => {
    if (!data) return;
    const next = configWithoutTimestamp(data);
    setConfig(next);
    setSavedConfig(next);
    setPreview(null);
    setServerError(null);
  }, [data]);

  const validation = useMemo(() => validatePublicCatalogDraft(config, options), [config, options]);
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const canSubmit = dirty && validation.errors.length === 0;

  const setConfigValue = (updater: (current: PublicCatalogConfig) => PublicCatalogConfig) => {
    setConfig(current => updater(current));
    setPreview(null);
    setServerError(null);
  };

  const selectedBySchema = useMemo(
    () => new Map(config.schemas.map(item => [item.schemaId, new Set(item.fieldIds)])),
    [config.schemas]
  );

  const configuredUnknownSchemas = config.schemas.filter(
    publication => !options.schemas.some(schema => schema.id === publication.schemaId)
  );

  const entityOptions = (currentIdentifier?: string) => {
    const current = selectorEntityByIdentifier(options, currentIdentifier);
    if (!currentIdentifier) return options.entities;
    if (current && current.id !== currentIdentifier) {
      return [{ ...current, id: currentIdentifier }, ...options.entities];
    }
    if (current || options.entities.some(entity => entity.id === currentIdentifier)) {
      return options.entities;
    }
    return [
      {
        id: currentIdentifier,
        publicId: currentIdentifier,
        slug: currentIdentifier,
        name: `Unavailable entity (${currentIdentifier})`,
        schemaId: '',
        schemaName: '',
        projectOnly: false,
        selectable: false,
        reason: 'This entity is no longer available'
      },
      ...options.entities
    ];
  };

  const pageCandidates = (page: PublicCatalogConfig['pages'][number]) => {
    const candidates = options.pages.filter(candidate => {
      if (candidate.scope !== page.scope) return false;
      if (page.scope === 'workspace') return true;
      if (!page.entityId) return true;
      return candidate.entityId === page.entityId || candidate.entityPublicId === page.entityId;
    });
    const current = options.pages.find(candidate => candidate.nodeId === page.nodeId);
    if (current && !candidates.some(candidate => candidate.nodeId === current.nodeId)) {
      return [current, ...candidates];
    }
    return candidates;
  };

  const apiArtifactOptions = (currentArtifactId: string) => {
    const current = selectorArtifactById(options, currentArtifactId);
    if (
      current ||
      options.apiArtifacts.some(artifact => artifact.artifactId === currentArtifactId)
    ) {
      return options.apiArtifacts;
    }
    return [
      {
        artifactId: currentArtifactId,
        entityId: '',
        entityPublicId: '',
        entityName: '',
        label: `Unavailable API artifact (${currentArtifactId})`,
        status: 'not_configured' as const,
        currentRevisionId: null,
        revisions: [],
        selectable: false,
        reason: 'This API artifact is no longer available'
      },
      ...options.apiArtifacts
    ];
  };

  const pageIsSelectable = (page: PublicCatalogSelectorOptions['pages'][number]) =>
    page.selectable &&
    (page.scope === 'workspace' ||
      isDraftEntityPublished(config, options, page.entityId ?? page.entityPublicId ?? undefined));

  const artifactIsSelectable = (artifact: PublicCatalogSelectorOptions['apiArtifacts'][number]) =>
    artifact.selectable && isDraftEntityPublished(config, options, artifact.entityId);

  const addEntityOverride = () => {
    const used = new Set(config.entityOverrides.map(override => override.entityId));
    const entity = options.entities.find(
      candidate => candidate.selectable && !used.has(candidate.id)
    );
    if (!entity) return;
    setConfigValue(current => ({
      ...current,
      entityOverrides: [...current.entityOverrides, { entityId: entity.id, mode: 'publish' }]
    }));
  };

  const addPage = () => {
    const candidate = options.pages.find(pageIsSelectable);
    if (!candidate) return;
    setConfigValue(current => ({
      ...current,
      pages: [
        ...current.pages,
        {
          nodeId: candidate.nodeId,
          scope: candidate.scope,
          entityId: candidate.entityId ?? undefined,
          publicPath: publicPathFromNodePath(candidate.path),
          label: undefined,
          order: current.pages.length
        }
      ]
    }));
  };

  const addApiArtifact = () => {
    const artifact = options.apiArtifacts.find(artifactIsSelectable);
    if (!artifact) return;
    setConfigValue(current => ({
      ...current,
      apiArtifacts: [...current.apiArtifacts, { artifactId: artifact.artifactId, exposeRaw: false }]
    }));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.pages.length) return;
    setConfigValue(current => {
      const pages = [...current.pages];
      const [page] = pages.splice(index, 1);
      pages.splice(target, 0, page!);
      return { ...current, pages: pages.map((item, order) => ({ ...item, order })) };
    });
  };

  const previewDraft = async () => {
    const next = normalizeConfigForSubmit(config);
    setServerError(null);
    try {
      setPreview(await previewMutation.mutateAsync(next));
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  const save = async () => {
    const next = normalizeConfigForSubmit(config);
    setServerError(null);
    try {
      await update.mutateAsync(next);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  };

  const cancel = () => {
    setConfig(savedConfig);
    setPreview(null);
    setServerError(null);
  };

  if (configLoading || optionsLoading)
    return <div className={styles.blockList}>Loading public catalog settings…</div>;
  if (configError || optionsError)
    return <div className={styles.blockList}>Unable to load public catalog settings.</div>;

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button disabled={!dirty || update.isPending || previewMutation.isPending} onClick={cancel}>
          Cancel
        </Button>
        <Button
          disabled={validation.errors.length > 0 || previewMutation.isPending}
          onClick={() => void previewDraft()}
        >
          {previewMutation.isPending ? 'Building preview…' : 'Preview catalog'}
        </Button>
        <Button
          variant="primary"
          disabled={!canSubmit || update.isPending || previewMutation.isPending}
          onClick={() => void save()}
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {validation.errors.length > 0 && (
        <div role="alert" style={errorStyle}>
          Fix or remove the highlighted selections before saving. {validation.errors.length}{' '}
          validation {validation.errors.length === 1 ? 'error' : 'errors'} found.
        </div>
      )}
      {serverError && (
        <div role="alert" style={errorStyle}>
          {serverError}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Public catalog</div>
          <div className={styles.sectionSub}>
            Publish a separate, read-only catalog for external consumers. Nothing is public until
            you enable it and select the content below.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Enable public catalog</div>
              <div className={styles.fieldHint}>Unauthenticated readers use the /public URL.</div>
            </div>
            <div className={styles.fieldRight}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={event =>
                  setConfigValue(current => ({ ...current, enabled: event.target.checked }))
                }
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Title</div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={config.title ?? ''}
                onChange={value =>
                  setConfigValue(current => ({ ...current, title: value ?? undefined }))
                }
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Description</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={config.description ?? ''}
                onChange={value =>
                  setConfigValue(current => ({ ...current, description: value ?? undefined }))
                }
                rows={4}
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Allow indexing</div>
              <div className={styles.fieldHint}>
                The default is noindex for private deployments.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <input
                type="checkbox"
                checked={config.indexable}
                onChange={event =>
                  setConfigValue(current => ({ ...current, indexable: event.target.checked }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Entity schemas and fields</div>
          <div className={styles.sectionSub}>
            Choose the fields that may be returned publicly. Restricted fields are marked and cannot
            be selected.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {options.schemas.map(schema => {
            const fields = selectedBySchema.get(schema.id);
            const schemaIndex = config.schemas.findIndex(item => item.schemaId === schema.id);
            return (
              <div key={schema.id} style={{ ...cardStyle, marginBottom: 8 }}>
                <label style={rowStyle}>
                  <input
                    type="checkbox"
                    checked={fields != null}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        schemas: event.target.checked
                          ? [...current.schemas, { schemaId: schema.id, fieldIds: [] }]
                          : current.schemas.filter(item => item.schemaId !== schema.id)
                      }))
                    }
                  />
                  <strong>{schema.name}</strong>
                  <span style={mutedStyle}>{schema.description}</span>
                </label>
                {fields && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                      gap: 6,
                      paddingLeft: 24
                    }}
                  >
                    {schema.fields.map(field => (
                      <label
                        key={field.id}
                        title={field.reason}
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          fontSize: 12,
                          opacity: field.selectable ? 1 : 0.6
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={fields.has(field.id)}
                          disabled={!field.selectable}
                          onChange={event =>
                            setConfigValue(current => ({
                              ...current,
                              schemas: current.schemas.map(item =>
                                item.schemaId !== schema.id
                                  ? item
                                  : {
                                      ...item,
                                      fieldIds: event.target.checked
                                        ? [...item.fieldIds, field.id]
                                        : item.fieldIds.filter(candidate => candidate !== field.id)
                                    }
                              )
                            }))
                          }
                        />
                        {field.name} <span style={mutedStyle}>({field.type})</span>
                      </label>
                    ))}
                  </div>
                )}
                {schemaIndex >= 0 && <InlineErrors errors={validation.schemaErrors[schemaIndex]} />}
              </div>
            );
          })}
          {configuredUnknownSchemas.map(publication => {
            const schemaIndex = config.schemas.indexOf(publication);
            return (
              <div
                key={`unknown-${publication.schemaId}`}
                style={{ ...cardStyle, marginBottom: 8 }}
              >
                <div style={rowStyle}>
                  <strong>Unavailable schema</strong>
                  <span style={mutedStyle}>{publication.schemaId}</span>
                  <Button
                    onClick={() =>
                      setConfigValue(current => ({
                        ...current,
                        schemas: current.schemas.filter(item => item !== publication)
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                <InlineErrors errors={validation.schemaErrors[schemaIndex]} />
              </div>
            );
          })}
          {options.schemas.length === 0 && configuredUnknownSchemas.length === 0 && (
            <div style={mutedStyle}>No schemas are available in this workspace.</div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Entity overrides</div>
          <div className={styles.sectionSub}>
            Publish or exclude individual entities and optionally choose a field set for each one.
            Entity names are shown here; stable entity IDs are submitted to the server.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button
              disabled={!options.entities.some(entity => entity.selectable)}
              onClick={addEntityOverride}
            >
              Add entity override
            </Button>
          </div>
          {config.entityOverrides.map((override, index) => {
            const entity = selectorEntityByIdentifier(options, override.entityId);
            const schema =
              entity && options.schemas.find(candidate => candidate.id === entity.schemaId);
            const availableFields = schema?.fields ?? [];
            return (
              <div key={`${override.entityId}-${index}`} style={{ ...cardStyle, marginBottom: 8 }}>
                <div style={rowStyle}>
                  <select
                    aria-label={`Entity override ${index + 1}`}
                    style={{ ...selectStyle, flex: '1 1 300px' }}
                    value={override.entityId}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, entityId: event.target.value, fieldIds: undefined }
                            : item
                        )
                      }))
                    }
                  >
                    {entityOptions(override.entityId).map(candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                        disabled={!candidate.selectable}
                      >
                        {entityLabel(candidate)}
                        {candidate.projectOnly ? ' · project-only' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Entity override mode ${index + 1}`}
                    style={selectStyle}
                    value={override.mode}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, mode: event.target.value as 'publish' | 'exclude' }
                            : item
                        )
                      }))
                    }
                  >
                    <option value="publish">Publish</option>
                    <option value="exclude">Exclude</option>
                  </select>
                  <Button
                    onClick={() =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.filter(
                          (_, itemIndex) => itemIndex !== index
                        )
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                {override.mode === 'publish' && entity && schema && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                    <div style={mutedStyle}>Fields for this entity</div>
                    <label style={rowStyle}>
                      <input
                        type="radio"
                        name={`entity-fields-${index}`}
                        checked={override.fieldIds == null}
                        onChange={() =>
                          setConfigValue(current => ({
                            ...current,
                            entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, fieldIds: undefined } : item
                            )
                          }))
                        }
                      />
                      Use the selected schema fields
                    </label>
                    <label style={rowStyle}>
                      <input
                        type="radio"
                        name={`entity-fields-${index}`}
                        checked={override.fieldIds != null}
                        onChange={() =>
                          setConfigValue(current => ({
                            ...current,
                            entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    fieldIds: availableFields
                                      .filter(field => field.selectable)
                                      .map(field => field.id)
                                  }
                                : item
                            )
                          }))
                        }
                      />
                      Choose fields for this entity
                    </label>
                    {override.fieldIds != null && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                          gap: 6,
                          paddingLeft: 24
                        }}
                      >
                        {availableFields.map(field => (
                          <label
                            key={field.id}
                            title={field.reason}
                            style={{ opacity: field.selectable ? 1 : 0.6, fontSize: 12 }}
                          >
                            <input
                              type="checkbox"
                              checked={override.fieldIds?.includes(field.id) ?? false}
                              disabled={!field.selectable}
                              onChange={event =>
                                setConfigValue(current => ({
                                  ...current,
                                  entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                                    itemIndex !== index
                                      ? item
                                      : {
                                          ...item,
                                          fieldIds: event.target.checked
                                            ? [...(item.fieldIds ?? []), field.id]
                                            : (item.fieldIds ?? []).filter(
                                                candidate => candidate !== field.id
                                              )
                                        }
                                  )
                                }))
                              }
                            />{' '}
                            {field.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <InlineErrors errors={validation.entityOverrideErrors[index]} />
              </div>
            );
          })}
          {config.entityOverrides.length === 0 && (
            <div style={mutedStyle}>No individual entity overrides are configured.</div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Wiki pages</div>
          <div className={styles.sectionSub}>
            Select non-project Markdown pages, choose a public path, and order them for the catalog
            manifest. Project-only and unpublished entity pages are unavailable.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button disabled={!options.pages.some(pageIsSelectable)} onClick={addPage}>
              Add wiki page
            </Button>
          </div>
          {config.pages.map((page, index) => {
            const candidates = pageCandidates(page);
            const currentCandidate = options.pages.find(
              candidate => candidate.nodeId === page.nodeId
            );
            const currentEntity = selectorEntityByIdentifier(options, page.entityId);
            const entityChoices = entityOptions(page.entityId);
            const pageCandidateIsSelectable = (
              candidate: PublicCatalogSelectorOptions['pages'][number]
            ) =>
              candidate.scope === page.scope &&
              (page.scope === 'workspace' ||
                (page.entityId != null &&
                  (candidate.entityId === page.entityId ||
                    candidate.entityPublicId === page.entityId))) &&
              pageIsSelectable(candidate);
            return (
              <div key={`${page.nodeId}-${index}`} style={{ ...cardStyle, marginBottom: 8 }}>
                <div style={rowStyle}>
                  <select
                    aria-label={`Wiki page scope ${index + 1}`}
                    style={selectStyle}
                    value={page.scope}
                    onChange={event => {
                      const scope = event.target.value as 'workspace' | 'entity';
                      const candidate = options.pages.find(
                        option => option.scope === scope && pageIsSelectable(option)
                      );
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) =>
                          itemIndex !== index
                            ? item
                            : {
                                ...item,
                                scope,
                                entityId:
                                  scope === 'entity'
                                    ? (candidate?.entityId ??
                                      item.entityId ??
                                      options.entities.find(entity =>
                                        isDraftEntityPublished(config, options, entity.id)
                                      )?.id)
                                    : undefined,
                                nodeId: candidate?.nodeId ?? item.nodeId,
                                publicPath: candidate
                                  ? publicPathFromNodePath(candidate.path)
                                  : item.publicPath
                              }
                        )
                      }));
                    }}
                  >
                    <option value="workspace">Workspace page</option>
                    <option value="entity">Entity page</option>
                  </select>
                  {page.scope === 'entity' && (
                    <select
                      aria-label={`Wiki page entity ${index + 1}`}
                      style={{ ...selectStyle, flex: '1 1 250px' }}
                      value={page.entityId ?? ''}
                      onChange={event => {
                        const entityId = event.target.value || undefined;
                        const candidate = options.pages.find(
                          option =>
                            pageIsSelectable(option) &&
                            option.scope === 'entity' &&
                            entityId != null &&
                            (option.entityId === entityId || option.entityPublicId === entityId)
                        );
                        setConfigValue(current => ({
                          ...current,
                          pages: current.pages.map((item, itemIndex) =>
                            itemIndex !== index
                              ? item
                              : {
                                  ...item,
                                  entityId,
                                  nodeId: candidate?.nodeId ?? item.nodeId,
                                  publicPath: candidate
                                    ? publicPathFromNodePath(candidate.path)
                                    : item.publicPath
                                }
                          )
                        }));
                      }}
                    >
                      <option value="">Choose an entity…</option>
                      {entityChoices.map(candidate => (
                        <option
                          key={candidate.id}
                          value={candidate.id}
                          disabled={
                            !candidate.selectable ||
                            !isDraftEntityPublished(config, options, candidate.id)
                          }
                        >
                          {entityLabel(candidate)}
                          {candidate.projectOnly ? ' · project-only' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label={`Wiki page ${index + 1}`}
                    style={{ ...selectStyle, flex: '1 1 300px' }}
                    value={page.nodeId}
                    onChange={event => {
                      const candidate = options.pages.find(
                        option => option.nodeId === event.target.value
                      );
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) =>
                          itemIndex !== index
                            ? item
                            : {
                                ...item,
                                nodeId: event.target.value,
                                publicPath: candidate
                                  ? publicPathFromNodePath(candidate.path)
                                  : item.publicPath
                              }
                        )
                      }));
                    }}
                  >
                    {page.nodeId &&
                      !candidates.some(candidate => candidate.nodeId === page.nodeId) && (
                        <option value={page.nodeId} disabled>
                          Unavailable page ({page.nodeId})
                        </option>
                      )}
                    {candidates.map(candidate => (
                      <option
                        key={candidate.nodeId}
                        value={candidate.nodeId}
                        disabled={!pageCandidateIsSelectable(candidate)}
                      >
                        {candidate.name} · {candidate.path}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={index === 0}
                    onClick={() => movePage(index, -1)}
                    aria-label={`Move wiki page ${index + 1} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    disabled={index === config.pages.length - 1}
                    onClick={() => movePage(index, 1)}
                    aria-label={`Move wiki page ${index + 1} down`}
                  >
                    ↓
                  </Button>
                  <Button
                    onClick={() =>
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.filter((_, itemIndex) => itemIndex !== index)
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                <div style={rowStyle}>
                  <label style={{ ...mutedStyle, minWidth: 80 }}>Public path</label>
                  <TextInput
                    value={page.publicPath}
                    onChange={value =>
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, publicPath: value ?? '' } : item
                        )
                      }))
                    }
                    style={{ flex: '1 1 260px', maxWidth: 520 }}
                  />
                  <label style={{ ...mutedStyle, minWidth: 45 }}>Label</label>
                  <TextInput
                    value={page.label ?? ''}
                    onChange={value =>
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: value ?? undefined } : item
                        )
                      }))
                    }
                    style={{ flex: '1 1 220px', maxWidth: 360 }}
                  />
                </div>
                {currentCandidate && !currentCandidate.selectable && (
                  <div style={mutedStyle}>{currentCandidate.reason}</div>
                )}
                {currentEntity && page.scope === 'entity' && !currentEntity.selectable && (
                  <div style={mutedStyle}>{currentEntity.reason}</div>
                )}
                <InlineErrors errors={validation.pageErrors[index]} />
              </div>
            );
          })}
          {config.pages.length === 0 && <div style={mutedStyle}>No wiki pages are configured.</div>}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>API specifications</div>
          <div className={styles.sectionSub}>
            Publish normalized API artifacts for published entities. Invalid revisions, project-only
            artifacts, and artifacts owned by unpublished entities cannot be selected.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button
              disabled={!options.apiArtifacts.some(artifactIsSelectable)}
              onClick={addApiArtifact}
            >
              Add API specification
            </Button>
          </div>
          {config.apiArtifacts.map((publication, index) => {
            const artifact = selectorArtifactById(options, publication.artifactId);
            const artifactChoices = apiArtifactOptions(publication.artifactId);
            return (
              <div
                key={`${publication.artifactId}-${index}`}
                style={{ ...cardStyle, marginBottom: 8 }}
              >
                <div style={rowStyle}>
                  <select
                    aria-label={`API artifact ${index + 1}`}
                    style={{ ...selectStyle, flex: '1 1 320px' }}
                    value={publication.artifactId}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, artifactId: event.target.value, revisionId: undefined }
                            : item
                        )
                      }))
                    }
                  >
                    {artifactChoices.map(candidate => (
                      <option
                        key={candidate.artifactId}
                        value={candidate.artifactId}
                        disabled={!artifactIsSelectable(candidate)}
                      >
                        {candidate.label} · {candidate.entityName || 'Unavailable entity'}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`API revision ${index + 1}`}
                    style={{ ...selectStyle, flex: '1 1 300px' }}
                    value={publication.revisionId ?? ''}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, revisionId: event.target.value || undefined }
                            : item
                        )
                      }))
                    }
                  >
                    <option value="">
                      Use current revision{artifact?.currentRevisionId ? '' : ' (none available)'}
                    </option>
                    {publication.revisionId &&
                      !artifact?.revisions.some(
                        revision => revision.revision.id === publication.revisionId
                      ) && (
                        <option value={publication.revisionId} disabled>
                          Unavailable revision ({publication.revisionId})
                        </option>
                      )}
                    {artifact?.revisions.map(revision => (
                      <option
                        key={revision.revision.id}
                        value={revision.revision.id}
                        disabled={!revision.selectable}
                      >
                        {revisionLabel(revision)} · {revision.revision.id}
                      </option>
                    ))}
                  </select>
                  <label
                    style={rowStyle}
                    title="Allow unauthenticated readers to download the source document"
                  >
                    <input
                      type="checkbox"
                      checked={publication.exposeRaw}
                      onChange={event =>
                        setConfigValue(current => ({
                          ...current,
                          apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, exposeRaw: event.target.checked }
                              : item
                          )
                        }))
                      }
                    />
                    Expose raw source
                  </label>
                  <Button
                    onClick={() =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.filter(
                          (_, itemIndex) => itemIndex !== index
                        )
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                {artifact && (
                  <div style={mutedStyle}>Status: {artifact.status.replaceAll('_', ' ')}</div>
                )}
                <InlineErrors errors={validation.apiArtifactErrors[index]} />
              </div>
            );
          })}
          {config.apiArtifacts.length === 0 && (
            <div style={mutedStyle}>No API specifications are configured.</div>
          )}
        </div>
      </div>

      {preview && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Catalog preview</div>
            <div className={styles.sectionSub}>
              This is the server-validated manifest produced by the current draft. It is not saved.
            </div>
          </div>
          <div className={styles.sectionBody}>
            <div style={rowStyle}>
              <strong>{preview.manifest.title}</strong>
              <span style={mutedStyle}>{preview.enabled ? 'Enabled' : 'Disabled'}</span>
              <span style={mutedStyle}>{preview.manifest.entityCount} published entities</span>
              <span style={mutedStyle}>{preview.manifest.pages.length} wiki pages</span>
              <span style={mutedStyle}>
                {preview.manifest.apiArtifacts.length} API specifications
              </span>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary>View manifest details</summary>
              <pre
                style={{
                  maxHeight: 420,
                  overflow: 'auto',
                  padding: 12,
                  marginTop: 8,
                  background: 'var(--panel-bg-alt, var(--panel-bg))',
                  border: '1px solid var(--panel-border)',
                  fontSize: 11
                }}
              >
                {JSON.stringify(preview.manifest, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};
