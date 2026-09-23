import { useQuery } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
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

export const strategyEntityDrawerProviderDefinitions = [
  {
    slotId: 'strategy.linked-objectives',
    requiredFields: BUSINESS_CAPABILITY_REQUIRED_FIELDS,
    Component: StrategyLinkedObjectivesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
