import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { resolveStrategyModelConfig, type StrategyModelConfig } from '../strategyQueries';
import { useCapabilityRealizedBy } from '../useCapabilityRealizedBy';
import styles from './StrategyEntityDrawerProviders.module.css';

const useStrategyConfiguration = (workspaceId: string) => {
  const query = useQuery(workspaceCapabilityConfigurationsQuery(workspaceId));
  return { query, config: resolveStrategyModelConfig(query.data) };
};

const isBusinessCapabilitySchema = (context: EntityDrawerProviderContext): boolean =>
  context.schema.fields.some(field => field.id === 'parent' && field.type === 'containment') &&
  context.schema.fields.some(field => field.id === 'capability_level');

const ProviderFrame = ({
  label,
  showLabel = true,
  children
}: {
  label: string;
  showLabel?: boolean;
  children: ReactNode;
}) => (
  <div className={styles.provider}>
    {showLabel && (
      <div className="dim" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
    )}
    {children}
  </div>
);

const StrategyRealizedByProvider = ({ context, label, showLabel }: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useStrategyConfiguration(context.workspaceId);
  const businessCapabilitySchemaId =
    config?.businessCapabilitySchemaId === context.schema.id
      ? config.businessCapabilitySchemaId
      : null;
  const realizedBy = useCapabilityRealizedBy(
    context.workspaceId,
    businessCapabilitySchemaId,
    context.entity._uid,
    config?.businessCapabilitySupportsEntityRelationSchemaId ?? null
  );
  const state = configurationQuery.isLoading
    ? 'loading'
    : configurationQuery.isError || !config || businessCapabilitySchemaId == null
      ? 'unavailable'
      : realizedBy.isLoading
        ? 'loading'
        : realizedBy.error
          ? 'unavailable'
          : realizedBy.items.length > 0
            ? 'ready'
            : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked applications, directly or across this capability's descendants."
        unavailableMessage="Realized-by relationships are unavailable."
      >
        <div className={styles.tags}>
          {realizedBy.items.map(({ entity, contributingCapability }) => (
            <Chip
              key={entity._uid}
              tone="ghost"
              title={
                contributingCapability ? `Realized via ${contributingCapability._name}` : undefined
              }
            >
              {entity._name}
              {contributingCapability && (
                <span className={styles.viaLabel}> · via {contributingCapability._name}</span>
              )}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const supportingObjectives = (
  context: EntityDrawerProviderContext,
  config: StrategyModelConfig | null
) =>
  config
    ? context.typedRelations.incoming.filter(
        relation =>
          relation._schema.id === config.objectiveSupportsBusinessCapabilityRelationSchemaId &&
          relation._out.id === context.entity._uid
      )
    : [];

const StrategyLinkedObjectivesProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useStrategyConfiguration(context.workspaceId);
  const matches = supportingObjectives(context, config);
  const state =
    configurationQuery.isLoading || context.typedRelationsStatus.isLoading
      ? 'loading'
      : configurationQuery.isError || !config || context.typedRelationsStatus.isError
        ? 'unavailable'
        : matches.length > 0
          ? 'ready'
          : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked objectives."
        unavailableMessage="Linked objectives are unavailable."
      >
        <div className={styles.tags}>
          {matches.map(relation => (
            <Chip key={relation._uid} tone="ghost">
              {relation._in.name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const StrategyLinkedInitiativesProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useStrategyConfiguration(context.workspaceId);
  const objectives = supportingObjectives(context, config);
  const objectiveIds = useMemo(
    () => [...new Set(objectives.map(relation => relation._in.id))],
    [objectives]
  );
  const initiatives = useQuery(
    entitiesQuery(
      context.workspaceId,
      {
        schemaId: config?.initiativeSchemaId,
        view: 'summary',
        conditions: [{ fieldId: 'objectives', op: 'in', value: objectiveIds }]
      },
      objectiveIds.length > 0 && config != null
    )
  );
  const state =
    configurationQuery.isLoading || context.typedRelationsStatus.isLoading
      ? 'loading'
      : configurationQuery.isError || !config || context.typedRelationsStatus.isError
        ? 'unavailable'
        : objectiveIds.length === 0
          ? 'empty'
          : initiatives.isLoading
            ? 'loading'
            : initiatives.isError
              ? 'unavailable'
              : (initiatives.data?.items.length ?? 0) > 0
                ? 'ready'
                : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked initiatives."
        unavailableMessage="Linked initiatives are unavailable."
      >
        <div className={styles.tags}>
          {(initiatives.data?.items ?? []).map(initiative => (
            <Chip key={initiative._uid} tone="ghost">
              {initiative._name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

export const strategyEntityDrawerProviderDefinitions = [
  {
    slotId: 'strategy.realized-by',
    supports: isBusinessCapabilitySchema,
    Component: StrategyRealizedByProvider
  },
  {
    slotId: 'strategy.linked-objectives',
    supports: isBusinessCapabilitySchema,
    Component: StrategyLinkedObjectivesProvider
  },
  {
    slotId: 'strategy.linked-initiatives',
    supports: isBusinessCapabilitySchema,
    Component: StrategyLinkedInitiativesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
