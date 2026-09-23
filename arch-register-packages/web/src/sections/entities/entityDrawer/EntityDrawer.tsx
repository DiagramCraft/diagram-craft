import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity, useEntitiesBySchema, useEntityRelations } from '../../../hooks/useEntities';
import { entitiesQuery } from '../../../queries/entities';
import { useEntityTypedRelations } from '../../../hooks/useRelations';
import { useEntityDrawerConfiguration } from '../../../hooks/useWorkspaceConfig';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { buildEntityRefLookup } from '../entityDetailHelpers';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import { buildFallbackEntityDrawerProfile } from '@arch-register/api-types/entityDrawerConfiguration';
import { DrawerPropertyRow } from './DrawerPropertyRow';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { formatDate, formatIsoDate } from '../../../utils/dateFormat';
import { usePrincipalLabel } from '../../../hooks/usePrincipalLabel';
import {
  entityDrawerMetadataValue,
  resolveEntityDrawerRenderModel,
  type ResolvedEntityDrawerBadge,
  type ResolvedEntityDrawerItem
} from './entityDrawerState';
import {
  EntityDrawerProviderFrame,
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext
} from './EntityDrawerProviderRegistry';
import { entityDrawerProviderRegistry } from './entityDrawerProviders';
import { RollupStatItem, RollupLeafCountItem } from './rollup/RollupItems';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RefLookup } from '../types/entityDetailTypes';
import type { EntityDrawerDateFormat } from '../../../shell/shellTypes';
import styles from './EntityDrawer.module.css';

const EntityDrawerBadge = ({
  resolved,
  entity,
  lifecycleStates
}: {
  resolved: ResolvedEntityDrawerBadge;
  entity: EntityRecord;
  lifecycleStates: ReturnType<typeof useWorkspaceContext>['lifecycleStates'];
}) => {
  const resolvePrincipalLabel = usePrincipalLabel();
  const value =
    resolved.badge.kind === 'metadata'
      ? entityDrawerMetadataValue(entity, resolved.badge.slot)
      : entity[resolved.badge.fieldId];

  if (resolved.badge.kind === 'metadata') {
    switch (resolved.badge.slot) {
      case 'lifecycle':
      case 'targetLifecycle':
        return entity[resolved.badge.slot === 'lifecycle' ? '_lifecycle' : '_targetLifecycle'] ? (
          <span className={styles.badgeWithLabel}>
            <span className={styles.badgeLabel}>{resolved.label}</span>
            <StatusChip
              value={
                entity[resolved.badge.slot === 'lifecycle' ? '_lifecycle' : '_targetLifecycle']!.id
              }
              lifecycleStates={lifecycleStates}
            />
          </span>
        ) : null;
      case 'tags':
        return (
          <span className={styles.badgeWithLabel}>
            <span className={styles.badgeLabel}>{resolved.label}</span>
            <span className={styles.badgeTags}>
              {(value as string[]).map(tag => (
                <Chip key={tag} tone="ghost">
                  {tag}
                </Chip>
              ))}
            </span>
          </span>
        );
      case 'owner': {
        const owner = entity._owner;
        return (
          <Chip tone="ghost">
            {resolved.label}: {owner?.name ?? '—'}
          </Chip>
        );
      }
      default:
        return (
          <Chip tone="ghost">
            {resolved.label}: {String(value)}
          </Chip>
        );
    }
  }

  const field = resolved.field;
  if (!field) return null;
  const displayValue = formatDrawerFieldValue(field, value, resolvePrincipalLabel);
  return (
    <Chip tone="ghost">
      {resolved.badge.showLabel === false ? displayValue : `${resolved.label}: ${displayValue}`}
    </Chip>
  );
};

const formatDrawerFieldValue = (
  field: NonNullable<ResolvedEntityDrawerBadge['field']>,
  value: unknown,
  resolvePrincipalLabel: (value: {
    principal_type?: string;
    principal_id?: string;
  }) => string | undefined
): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value))
    return value.map(item => formatDrawerFieldValue(field, item, resolvePrincipalLabel)).join(', ');
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'currency') return formatCurrencyValue(value);
  if (field.type === 'principal' && typeof value === 'object' && value !== null) {
    const principal = value as { principal_type?: string; principal_id?: string };
    return principal.principal_id
      ? (resolvePrincipalLabel(principal) ?? principal.principal_id)
      : '—';
  }
  if (field.type === 'select') {
    const option = field.options?.find(candidate => candidate.value === String(value));
    return option?.label ?? String(value);
  }
  if (field.type === 'derived' && field.resultType === 'select') {
    const option = field.options?.find(candidate => candidate.value === String(value));
    return option?.label ?? String(value);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const MetadataItem = ({
  item,
  entity,
  lifecycleStates
}: {
  item: ResolvedEntityDrawerItem;
  entity: NonNullable<ReturnType<typeof useEntity>['data']>;
  lifecycleStates: ReturnType<typeof useWorkspaceContext>['lifecycleStates'];
}) => {
  if (item.item.kind !== 'metadata') return null;
  const value = entityDrawerMetadataValue(entity, item.item.slot);
  if (item.item.slot === 'lifecycle' || item.item.slot === 'targetLifecycle') {
    const lifecycle = value as { id: string } | null;
    return (
      <div className={styles.metadataRow}>
        <span className={styles.metadataLabel}>{item.label}</span>
        <span className={styles.metadataValue}>
          {lifecycle ? (
            <StatusChip value={lifecycle.id} lifecycleStates={lifecycleStates} />
          ) : (
            <span className="dim">—</span>
          )}
        </span>
      </div>
    );
  }
  if (item.item.slot === 'tags') {
    return (
      <div className={styles.metadataRow}>
        <span className={styles.metadataLabel}>{item.label}</span>
        <span className={styles.metadataValue}>
          <span className={styles.tags}>
            {(value as string[]).map(tag => (
              <Chip key={tag} tone="ghost">
                {tag}
              </Chip>
            ))}
          </span>
        </span>
      </div>
    );
  }
  const display =
    item.item.slot === 'owner'
      ? (entity._owner?.name ?? '—')
      : item.item.slot === 'targetLifecycleDate'
        ? formatDate(value)
        : String(value ?? '—');
  return (
    <div className={styles.metadataRow}>
      <span className={styles.metadataLabel}>{item.label}</span>
      <span className={styles.metadataValue}>{display}</span>
    </div>
  );
};

const ContainmentChildrenItem = ({
  item,
  entity,
  label,
  workspaceSlug,
  openEntity
}: {
  item: Extract<ResolvedEntityDrawerItem['item'], { kind: 'children' }>;
  entity: EntityRecord;
  label: string;
  workspaceSlug: string;
  openEntity: (entityId: string) => void;
}) => {
  const query = useQuery(
    entitiesQuery(workspaceSlug, {
      schemaId: item.childSchemaId,
      view: 'summary',
      conditions: [{ fieldId: item.fieldId, op: 'equals', value: entity._uid }]
    })
  );
  const children = query.data?.items ?? [];
  const state = query.isLoading
    ? 'loading'
    : query.isError
      ? 'unavailable'
      : children.length > 0
        ? 'ready'
        : 'empty';

  return (
    <div className={styles.childrenItem}>
      <div className="dim" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No children."
        unavailableMessage="Children are unavailable."
      >
        <div className={styles.childrenTags}>
          {children.map(child => (
            <button
              key={child._uid}
              type="button"
              className={styles.childChip}
              onClick={() => openEntity(child._uid)}
            >
              {child._name}
            </button>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </div>
  );
};

const DrawerItem = ({
  item,
  providerContext,
  entity,
  lifecycleStates,
  refLookup,
  referenceOptions,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas,
  workspaceSlug,
  formatDateValue,
  onOpenEntity,
  onOpenRelatedEntity
}: {
  item: ResolvedEntityDrawerItem;
  providerContext: EntityDrawerProviderContext;
  entity: NonNullable<ReturnType<typeof useEntity>['data']>;
  lifecycleStates: ReturnType<typeof useWorkspaceContext>['lifecycleStates'];
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
  workspaceSlug: string;
  formatDateValue?: (value: unknown) => string;
  onOpenEntity?: (entityId: string) => void;
  onOpenRelatedEntity?: (fieldId: string, publicId: string) => boolean;
}) => {
  if (item.item.kind === 'metadata') {
    return <MetadataItem item={item} entity={entity} lifecycleStates={lifecycleStates} />;
  }
  if (item.item.kind === 'children') {
    return (
      <ContainmentChildrenItem
        item={item.item}
        entity={entity}
        label={item.label}
        workspaceSlug={workspaceSlug}
        openEntity={providerContext.openEntity}
      />
    );
  }
  if (item.item.kind === 'rollup') {
    return (
      <RollupStatItem
        item={item.item}
        label={item.label}
        entity={entity}
        context={providerContext}
      />
    );
  }
  if (item.item.kind === 'rollup-leaf-count') {
    return (
      <RollupLeafCountItem
        item={item.item}
        label={item.label}
        entity={entity}
        context={providerContext}
      />
    );
  }
  if (item.item.kind === 'slot' && item.provider) {
    const Provider = item.provider.Component;
    const LabelAdornment = item.provider.LabelAdornment;
    const showLabel = item.item.showLabel !== false;
    return (
      <EntityDrawerProviderFrame
        label={item.label}
        showLabel={showLabel}
        presentation={item.item.presentation}
        labelAdornment={
          showLabel && LabelAdornment ? (
            <LabelAdornment context={providerContext} item={item.item} />
          ) : undefined
        }
      >
        <Provider
          context={providerContext}
          item={item.item}
          presentation={item.item.presentation}
        />
      </EntityDrawerProviderFrame>
    );
  }
  if (!item.field) return null;
  return (
    <DrawerPropertyRow
      field={item.field}
      label={item.label}
      value={entity[item.field.id]}
      presentation={item.item.presentation === 'mini-panel' ? 'mini-panel' : 'row'}
      refLookup={refLookup}
      referenceOptions={referenceOptions}
      typedRelationsOutgoing={typedRelationsOutgoing}
      typedRelationsIncoming={typedRelationsIncoming}
      relationSchemas={relationSchemas}
      workspaceSlug={workspaceSlug}
      formatDateValue={formatDateValue}
      onOpenEntity={onOpenEntity}
      onOpenRelatedEntity={onOpenRelatedEntity}
      externalMeta={entity._externalMetadata?.[item.field.id]}
    />
  );
};

export const EntityDrawer = ({
  workspaceSlug,
  entityId,
  onClose,
  onOpenEntity,
  active = true,
  stacked = false,
  stackOffset = 0,
  onOpenGovernanceCase,
  onOpenRelatedEntity,
  entityOverride,
  additionalBadges,
  entityQueryEnabled = true,
  entityLoading = false,
  entityUnavailable = false,
  entityLabel,
  loadingMessage = `Loading ${entityLabel ?? 'entity'}…`,
  unavailableMessage = `This ${entityLabel ?? 'entity'} is unavailable.`,
  formatDateValue,
  dateFormat
}: {
  workspaceSlug: string;
  entityId: string;
  onClose: () => void;
  onOpenEntity?: (entityId: string) => void;
  active?: boolean;
  stacked?: boolean;
  stackOffset?: number;
  onOpenGovernanceCase?: (caseId: string) => void;
  onOpenRelatedEntity?: (fieldId: string, publicId: string) => boolean;
  entityOverride?: EntityRecord;
  additionalBadges?: ReactNode | ((entity: EntityRecord) => ReactNode);
  entityQueryEnabled?: boolean;
  entityLoading?: boolean;
  entityUnavailable?: boolean;
  /** Short noun (e.g. "risk", "contract") used to compose the default loading/unavailable copy. */
  entityLabel?: string;
  loadingMessage?: ReactNode;
  unavailableMessage?: ReactNode;
  formatDateValue?: (value: unknown) => string;
  dateFormat?: EntityDrawerDateFormat;
}) => {
  const navigate = useNavigate();
  const { schemas, relationSchemas, lifecycleStates } = useWorkspaceContext();
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceSlug);
  const entityQuery = useEntity(
    workspaceSlug,
    entityId,
    entityQueryEnabled && entityOverride === undefined
  );
  const entity = entityOverride ?? entityQuery.data;
  const resolvedFormatDateValue =
    formatDateValue ?? (dateFormat === 'iso' ? formatIsoDate : undefined);
  const relationsQuery = useEntityRelations(workspaceSlug, entity?._uid ?? entityId);
  const typedRelationsQuery = useEntityTypedRelations(workspaceSlug, entity?._uid ?? entityId);
  const configurationQuery = useEntityDrawerConfiguration(workspaceSlug);

  const schema = schemas.find(candidate => candidate.id === entity?._schema.id);
  const referenceSchemaIds = useMemo(
    () =>
      schema
        ? [
            ...new Set(
              schema.fields.filter(isReferenceOrContainmentField).map(field => field.schemaId)
            )
          ]
        : [],
    [schema]
  );
  const referenceQueries = useEntitiesBySchema(workspaceSlug, referenceSchemaIds);
  const referenceOptions = useMemo(() => {
    const options: Record<string, NonNullable<(typeof referenceQueries)[number]['data']>> = {};
    referenceSchemaIds.forEach((schemaId, index) => {
      const data = referenceQueries[index]?.data;
      if (data) options[schemaId] = data;
    });
    return options;
  }, [referenceQueries, referenceSchemaIds]);

  const relations = relationsQuery.data ?? { outgoing: [], incoming: [] };
  const typedRelations = typedRelationsQuery.data ?? { outgoing: [], incoming: [] };
  const refLookup = useMemo(() => buildEntityRefLookup(relations), [relations]);

  const openEntity = useCallback(
    (targetId: string) => {
      if (onOpenEntity) {
        onOpenEntity(targetId);
        return;
      }
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(targetId)));
    },
    [navigate, onOpenEntity, workspaceSlug]
  );

  const providerContext = useMemo<EntityDrawerProviderContext | null>(
    () =>
      entity && schema
        ? {
            workspaceId: workspaceSlug,
            entity,
            schema,
            schemas,
            relationSchemas,
            relations,
            typedRelations,
            typedRelationsStatus: {
              isLoading: typedRelationsQuery.isLoading,
              isError: typedRelationsQuery.isError
            },
            openEntity,
            openGovernanceCase: onOpenGovernanceCase
          }
        : null,
    [
      entity,
      schema,
      workspaceSlug,
      schemas,
      relationSchemas,
      relations,
      typedRelations,
      typedRelationsQuery.isLoading,
      typedRelationsQuery.isError,
      openEntity,
      onOpenGovernanceCase
    ]
  );

  const profile = useMemo(
    () =>
      schema
        ? (configurationQuery.data?.effective_configuration.profiles[schema.id] ??
          buildFallbackEntityDrawerProfile(schema))
        : null,
    [configurationQuery.data?.effective_configuration.profiles, schema]
  );
  const renderModel = useMemo(
    () =>
      entity && schema && profile && providerContext
        ? resolveEntityDrawerRenderModel({
            entity,
            schema,
            profile,
            providerRegistry: entityDrawerProviderRegistry,
            providerContext,
            getFieldGroupAccess
          })
        : null,
    [entity, schema, profile, providerContext, getFieldGroupAccess]
  );
  const [openSections, setOpenSections] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (renderModel) setOpenSections(new Set(renderModel.sections.map(section => section.id)));
  }, [renderModel]);

  if (entityLoading || (entityOverride === undefined && entityQuery.isLoading)) {
    return (
      <Drawer
        onClose={onClose}
        title="Loading…"
        active={active}
        stacked={stacked}
        stackOffset={stackOffset}
      >
        <div className={styles.empty}>{loadingMessage}</div>
      </Drawer>
    );
  }
  if (entityUnavailable || (entityOverride === undefined && entityQuery.isError) || !entity) {
    return (
      <Drawer
        onClose={onClose}
        title="Unavailable"
        active={active}
        stacked={stacked}
        stackOffset={stackOffset}
      >
        <div className={styles.empty}>{unavailableMessage}</div>
      </Drawer>
    );
  }
  if (!schema || !renderModel || !providerContext) {
    return (
      <Drawer
        onClose={onClose}
        active={active}
        stacked={stacked}
        stackOffset={stackOffset}
        eyebrow={<span className="dim mono">{entity._publicId}</span>}
        title={entity._name}
        footer={
          <Button
            variant="primary"
            onClick={() =>
              navigate({
                ...entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)),
                search: (previous: Record<string, unknown>) => ({
                  ...previous,
                  drawer: undefined
                })
              } as unknown as Parameters<typeof navigate>[0])
            }
          >
            Open record in Entities
          </Button>
        }
      >
        <div className={styles.empty}>This entity schema is unavailable.</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      onClose={onClose}
      active={active}
      stacked={stacked}
      stackOffset={stackOffset}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        renderModel.badges.length > 0 || additionalBadges != null ? (
          <div className={styles.badges}>
            {renderModel.badges.map((badge, index) => (
              <EntityDrawerBadge
                key={`${badge.badge.kind}-${index}`}
                resolved={badge}
                entity={entity}
                lifecycleStates={lifecycleStates}
              />
            ))}
            {typeof additionalBadges === 'function' ? additionalBadges(entity) : additionalBadges}
          </div>
        ) : undefined
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate({
              ...entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)),
              search: (previous: Record<string, unknown>) => ({
                ...previous,
                drawer: undefined
              })
            } as unknown as Parameters<typeof navigate>[0])
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sections}>
        {renderModel.sections.map(section => {
          const showTitle = section.showTitle !== false;
          const isOpen = !showTitle || (openSections?.has(section.id) ?? true);
          const content = (
            <div
              className={`${styles.sectionContent} ${
                section.layout === 'stat-grid' ? styles.sectionContentStatGrid : ''
              }`}
              hidden={!isOpen}
            >
              {section.items.map((item, index) => (
                <div
                  className={
                    item.item.kind === 'field' || item.item.kind === 'relation'
                      ? item.item.presentation === 'mini-panel'
                        ? item.field?.type === 'typedRelation'
                          ? styles.relationPanelItem
                          : styles.miniPanelItem
                        : styles.fieldItem
                      : styles.item
                  }
                  key={`${item.item.kind}-${index}`}
                >
                  <DrawerItem
                    item={item}
                    providerContext={providerContext}
                    entity={entity}
                    lifecycleStates={lifecycleStates}
                    refLookup={refLookup}
                    referenceOptions={referenceOptions}
                    typedRelationsOutgoing={typedRelations.outgoing}
                    typedRelationsIncoming={typedRelations.incoming}
                    relationSchemas={relationSchemas}
                    workspaceSlug={workspaceSlug}
                    formatDateValue={resolvedFormatDateValue}
                    onOpenEntity={onOpenEntity}
                    onOpenRelatedEntity={onOpenRelatedEntity}
                  />
                </div>
              ))}
            </div>
          );
          return (
            <section className={styles.section} key={section.id}>
              {showTitle && section.collapsible ? (
                <h3 className={styles.sectionHeading}>
                  <button
                    type="button"
                    className={styles.sectionToggle}
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenSections(previous => {
                        const next = new Set(previous ?? renderModel.sections.map(item => item.id));
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        return next;
                      })
                    }
                  >
                    {section.title}
                  </button>
                </h3>
              ) : showTitle ? (
                <h3 className={styles.sectionTitle}>{section.title}</h3>
              ) : null}
              {content}
            </section>
          );
        })}
      </div>
    </Drawer>
  );
};
