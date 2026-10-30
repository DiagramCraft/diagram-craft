import styles from './PublicCatalogSubSection.module.css';
import { Banner } from '../../../components/Banner';
import { LoadingState } from '../../../components/LoadingState';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDown, TbArrowUp, TbDots, TbTrash } from 'react-icons/tb';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { Select } from '@diagram-craft/app-components/Select';
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
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';

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

const EntryMenu = ({ label, items }: { label: string; items: MenuItem[] }) => (
  <div className={styles.entryMenu}>
    <DropdownMenu
      trigger={
        <Button variant="icon-only" aria-label={label}>
          <TbDots size={14} />
        </Button>
      }
      items={items}
    />
  </div>
);

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
    <div role="alert" className={styles.error}>
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
    return <LoadingState text="Loading public catalog settings…" size="sm" />;
  if (configError || optionsError)
    return <Banner variant="error">Failed to load public catalog settings.</Banner>;

  return (
    <>
      <SectionActions>
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
      </SectionActions>
      {validation.errors.length > 0 && (
        <div role="alert" className={styles.error}>
          Fix or remove the highlighted selections before saving. {validation.errors.length}{' '}
          validation {validation.errors.length === 1 ? 'error' : 'errors'} found.
        </div>
      )}
      {serverError && (
        <div role="alert" className={styles.error}>
          {serverError}
        </div>
      )}

      <SettingsBlock
        title="Public catalog"
        description="Publish a separate, read-only catalog for external consumers. Nothing is public until you enable it and select the content below."
      >
        <SettingsBlockField
          label="Enable public catalog"
          hint="Unauthenticated readers use the /public URL."
        >
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={event =>
              setConfigValue(current => ({ ...current, enabled: event.target.checked }))
            }
          />
        </SettingsBlockField>
        <SettingsBlockField label="Title">
          <TextInput
            value={config.title ?? ''}
            onChange={value =>
              setConfigValue(current => ({ ...current, title: value ?? undefined }))
            }
            style={{ maxWidth: 540 }}
          />
        </SettingsBlockField>
        <SettingsBlockField label="Description" align="top">
          <TextArea
            value={config.description ?? ''}
            onChange={value =>
              setConfigValue(current => ({ ...current, description: value ?? undefined }))
            }
            rows={4}
            style={{ maxWidth: 540 }}
          />
        </SettingsBlockField>
        <SettingsBlockField
          label="Allow indexing"
          hint="The default is noindex for private deployments."
        >
          <input
            type="checkbox"
            checked={config.indexable}
            onChange={event =>
              setConfigValue(current => ({ ...current, indexable: event.target.checked }))
            }
          />
        </SettingsBlockField>
      </SettingsBlock>

      <SettingsBlock
        title="Entity schemas and fields"
        description="Choose the fields that may be returned publicly. Restricted fields are marked and cannot be selected."
      >
        {options.schemas.map(schema => {
          const fields = selectedBySchema.get(schema.id);
          const schemaIndex = config.schemas.findIndex(item => item.schemaId === schema.id);
          return (
            <SettingsBlockField
              key={schema.id}
              align="top"
              label={
                <label className={styles.row}>
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
                  {schema.name}
                </label>
              }
            >
              {fields && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 6
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
                      {field.name} <span className={styles.muted}>({field.type})</span>
                    </label>
                  ))}
                </div>
              )}
              {schemaIndex >= 0 && <InlineErrors errors={validation.schemaErrors[schemaIndex]} />}
            </SettingsBlockField>
          );
        })}
        {configuredUnknownSchemas.map(publication => {
          const schemaIndex = config.schemas.indexOf(publication);
          return (
            <SettingsBlockField
              key={`unknown-${publication.schemaId}`}
              align="top"
              label="Unavailable schema"
              hint={publication.schemaId}
            >
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
              <InlineErrors errors={validation.schemaErrors[schemaIndex]} />
            </SettingsBlockField>
          );
        })}
        {options.schemas.length === 0 && configuredUnknownSchemas.length === 0 && (
          <div className={styles.muted}>No schemas are available in this workspace.</div>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="Entity overrides"
        description="Publish or exclude individual entities and optionally choose a field set for each one. Entity names are shown here; stable entity IDs are submitted to the server."
        actions={
          <Button
            disabled={!options.entities.some(entity => entity.selectable)}
            onClick={addEntityOverride}
          >
            Add entity override
          </Button>
        }
      >
        {config.entityOverrides.map((override, index) => {
          const entity = selectorEntityByIdentifier(options, override.entityId);
          const schema =
            entity && options.schemas.find(candidate => candidate.id === entity.schemaId);
          const availableFields = schema?.fields ?? [];
          return (
            <div key={`${override.entityId}-${index}`} className={styles.card}>
              <EntryMenu
                label={`Entity override ${index + 1} actions`}
                items={[
                  {
                    label: 'Remove',
                    icon: <TbTrash size={14} />,
                    danger: true,
                    onClick: () =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.filter(
                          (_, itemIndex) => itemIndex !== index
                        )
                      }))
                  }
                ]}
              />
              <div className={`${styles.row} ${styles.rowWithMenu}`}>
                <div style={{ flex: '1 1 300px' }}>
                  <Select.Root
                    aria-label={`Entity override ${index + 1}`}
                    value={override.entityId}
                    onChange={selected =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, entityId: selected ?? '', fieldIds: undefined }
                            : item
                        )
                      }))
                    }
                  >
                    {entityOptions(override.entityId).map(candidate => (
                      <Select.Item
                        key={candidate.id}
                        value={candidate.id}
                        disabled={!candidate.selectable}
                      >
                        {entityLabel(candidate)}
                        {candidate.projectOnly ? ' · project-only' : ''}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
                <div style={{ flex: '0 1 160px' }}>
                  <Select.Root
                    aria-label={`Entity override mode ${index + 1}`}
                    value={override.mode}
                    onChange={selected =>
                      setConfigValue(current => ({
                        ...current,
                        entityOverrides: current.entityOverrides.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, mode: (selected ?? '') as 'publish' | 'exclude' }
                            : item
                        )
                      }))
                    }
                  >
                    <Select.Item value="publish">Publish</Select.Item>
                    <Select.Item value="exclude">Exclude</Select.Item>
                  </Select.Root>
                </div>
              </div>
              {override.mode === 'publish' && entity && schema && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                  <div className={styles.muted}>Fields for this entity</div>
                  <label className={`${styles.row} ${styles.rowSmall}`}>
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
                  <label className={`${styles.row} ${styles.rowSmall}`}>
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
          <div className={styles.muted}>No individual entity overrides are configured.</div>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="Wiki pages"
        description="Select non-project Markdown pages, choose a public path, and order them for the catalog manifest. Project-only and unpublished entity pages are unavailable."
        actions={
          <Button disabled={!options.pages.some(pageIsSelectable)} onClick={addPage}>
            Add wiki page
          </Button>
        }
      >
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
            <div key={`${page.nodeId}-${index}`} className={styles.card}>
              <EntryMenu
                label={`Wiki page ${index + 1} actions`}
                items={[
                  {
                    label: 'Move up',
                    icon: <TbArrowUp size={14} />,
                    disabled: index === 0,
                    onClick: () => movePage(index, -1)
                  },
                  {
                    label: 'Move down',
                    icon: <TbArrowDown size={14} />,
                    disabled: index === config.pages.length - 1,
                    onClick: () => movePage(index, 1)
                  },
                  {
                    label: 'Remove',
                    icon: <TbTrash size={14} />,
                    danger: true,
                    onClick: () =>
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.filter((_, itemIndex) => itemIndex !== index)
                      }))
                  }
                ]}
              />
              <div className={`${styles.row} ${styles.rowWithMenu}`}>
                <div style={{ flex: '0 1 160px' }}>
                  <Select.Root
                    aria-label={`Wiki page scope ${index + 1}`}
                    value={page.scope}
                    onChange={selected => {
                      const scope = (selected ?? '') as 'workspace' | 'entity';
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
                    <Select.Item value="workspace">Workspace page</Select.Item>
                    <Select.Item value="entity">Entity page</Select.Item>
                  </Select.Root>
                </div>
                {page.scope === 'entity' && (
                  <div style={{ flex: '1 1 250px' }}>
                    <Select.Root
                      aria-label={`Wiki page entity ${index + 1}`}
                      value={page.entityId ?? ''}
                      onChange={selected => {
                        const entityId = selected || undefined;
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
                      <Select.Item value="">Choose an entity…</Select.Item>
                      {entityChoices.map(candidate => (
                        <Select.Item
                          key={candidate.id}
                          value={candidate.id}
                          disabled={
                            !candidate.selectable ||
                            !isDraftEntityPublished(config, options, candidate.id)
                          }
                        >
                          {entityLabel(candidate)}
                          {candidate.projectOnly ? ' · project-only' : ''}
                        </Select.Item>
                      ))}
                    </Select.Root>
                  </div>
                )}
                <div style={{ flex: '1 1 300px' }}>
                  <Select.Root
                    aria-label={`Wiki page ${index + 1}`}
                    value={page.nodeId}
                    onChange={selected => {
                      const candidate = options.pages.find(
                        option => option.nodeId === (selected ?? '')
                      );
                      setConfigValue(current => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) =>
                          itemIndex !== index
                            ? item
                            : {
                                ...item,
                                nodeId: selected ?? '',
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
                        <Select.Item value={page.nodeId} disabled>
                          Unavailable page ({page.nodeId})
                        </Select.Item>
                      )}
                    {candidates.map(candidate => (
                      <Select.Item
                        key={candidate.nodeId}
                        value={candidate.nodeId}
                        disabled={!pageCandidateIsSelectable(candidate)}
                      >
                        {candidate.name} · {candidate.path}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
              </div>
              <div className={styles.row}>
                <label className={`${styles.muted} ${styles.labelMuted}`}>Public path</label>
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
                <label className={`${styles.muted} ${styles.labelMutedSm}`}>Label</label>
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
                <div className={styles.muted}>{currentCandidate.reason}</div>
              )}
              {currentEntity && page.scope === 'entity' && !currentEntity.selectable && (
                <div className={styles.muted}>{currentEntity.reason}</div>
              )}
              <InlineErrors errors={validation.pageErrors[index]} />
            </div>
          );
        })}
        {config.pages.length === 0 && (
          <div className={styles.muted}>No wiki pages are configured.</div>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="API specifications"
        description="Publish normalized API artifacts for published entities. Invalid revisions, project-only artifacts, and artifacts owned by unpublished entities cannot be selected."
        actions={
          <Button
            disabled={!options.apiArtifacts.some(artifactIsSelectable)}
            onClick={addApiArtifact}
          >
            Add API specification
          </Button>
        }
      >
        {config.apiArtifacts.map((publication, index) => {
          const artifact = selectorArtifactById(options, publication.artifactId);
          const artifactChoices = apiArtifactOptions(publication.artifactId);
          return (
            <div key={`${publication.artifactId}-${index}`} className={styles.card}>
              <EntryMenu
                label={`API specification ${index + 1} actions`}
                items={[
                  {
                    label: 'Remove',
                    icon: <TbTrash size={14} />,
                    danger: true,
                    onClick: () =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.filter(
                          (_, itemIndex) => itemIndex !== index
                        )
                      }))
                  }
                ]}
              />
              <div className={`${styles.row} ${styles.rowWithMenu}`}>
                <div style={{ flex: '1 1 320px' }}>
                  <Select.Root
                    aria-label={`API artifact ${index + 1}`}
                    value={publication.artifactId}
                    onChange={selected =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, artifactId: selected ?? '', revisionId: undefined }
                            : item
                        )
                      }))
                    }
                  >
                    {artifactChoices.map(candidate => (
                      <Select.Item
                        key={candidate.artifactId}
                        value={candidate.artifactId}
                        disabled={!artifactIsSelectable(candidate)}
                      >
                        {candidate.label} · {candidate.entityName || 'Unavailable entity'}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  <Select.Root
                    aria-label={`API revision ${index + 1}`}
                    value={publication.revisionId ?? ''}
                    onChange={selected =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, revisionId: selected || undefined }
                            : item
                        )
                      }))
                    }
                  >
                    <Select.Item value="">
                      Use current revision{artifact?.currentRevisionId ? '' : ' (none available)'}
                    </Select.Item>
                    {publication.revisionId &&
                      !artifact?.revisions.some(
                        revision => revision.revision.id === publication.revisionId
                      ) && (
                        <Select.Item value={publication.revisionId} disabled>
                          Unavailable revision ({publication.revisionId})
                        </Select.Item>
                      )}
                    {artifact?.revisions.map(revision => (
                      <Select.Item
                        key={revision.revision.id}
                        value={revision.revision.id}
                        disabled={!revision.selectable}
                      >
                        {revisionLabel(revision)} · {revision.revision.id}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
                <label
                  className={styles.row}
                  title="Allow unauthenticated readers to download the source document"
                >
                  <input
                    type="checkbox"
                    checked={publication.exposeRaw}
                    onChange={event =>
                      setConfigValue(current => ({
                        ...current,
                        apiArtifacts: current.apiArtifacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, exposeRaw: event.target.checked } : item
                        )
                      }))
                    }
                  />
                  Expose raw source
                </label>
              </div>
              {artifact && (
                <div className={styles.muted}>Status: {artifact.status.replaceAll('_', ' ')}</div>
              )}
              <InlineErrors errors={validation.apiArtifactErrors[index]} />
            </div>
          );
        })}
        {config.apiArtifacts.length === 0 && (
          <div className={styles.muted}>No API specifications are configured.</div>
        )}
      </SettingsBlock>

      {preview && (
        <SettingsBlock
          title="Catalog preview"
          description="This is the server-validated manifest produced by the current draft. It is not saved."
        >
          <div className={styles.row}>
            <strong>{preview.manifest.title}</strong>
            <span className={styles.muted}>{preview.enabled ? 'Enabled' : 'Disabled'}</span>
            <span className={styles.muted}>{preview.manifest.entityCount} published entities</span>
            <span className={styles.muted}>{preview.manifest.pages.length} wiki pages</span>
            <span className={styles.muted}>
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
        </SettingsBlock>
      )}
    </>
  );
};
