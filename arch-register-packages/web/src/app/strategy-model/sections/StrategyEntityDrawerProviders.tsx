import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps,
  type EntityDrawerRequiredField
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { resolveStrategyModelConfig, type StrategyModelConfig } from '../strategyQueries';
import styles from './StrategyEntityDrawerProviders.module.css';

const useStrategyConfiguration = (workspaceId: string) => {
  const query = useQuery(workspaceCapabilityConfigurationsQuery(workspaceId));
  return { query, config: resolveStrategyModelConfig(query.data) };
};

const BUSINESS_CAPABILITY_REQUIRED_FIELDS = [
  { id: 'parent', type: 'containment' },
  { id: 'capability_level' }
] satisfies readonly EntityDrawerRequiredField[];

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

const StrategyLinkedObjectivesProvider = ({ context }: EntityDrawerProviderProps) => {
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
  );
};

const StrategyLinkedInitiativesProvider = ({ context }: EntityDrawerProviderProps) => {
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
  );
};

export const strategyEntityDrawerProviderDefinitions = [
  {
    slotId: 'strategy.linked-objectives',
    requiredFields: BUSINESS_CAPABILITY_REQUIRED_FIELDS,
    Component: StrategyLinkedObjectivesProvider
  },
  {
    slotId: 'strategy.linked-initiatives',
    requiredFields: BUSINESS_CAPABILITY_REQUIRED_FIELDS,
    Component: StrategyLinkedInitiativesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
