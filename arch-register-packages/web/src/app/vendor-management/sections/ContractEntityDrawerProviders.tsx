import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
import { entityDetailQuery } from '../../../queries/entities';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { scalarValues } from '../../../lib/scalarFieldValues';
import styles from './VendorDrawer.module.css';

const supportsContractSchema = (context: EntityDrawerProviderContext): boolean => {
  const systemField = context.schema.fields.find(field => field.id === 'system');
  return systemField?.type === 'typedRelation';
};

const ContractSystemsUsedProvider = ({
  context,
  label,
  showLabel = true
}: EntityDrawerProviderProps) => {
  const systemIds = useMemo(
    () => [...new Set(scalarValues(context.entity.system).filter((id): id is string => !!id))],
    [context.entity.system]
  );
  const queries = useQueries({
    queries: systemIds.map(id => entityDetailQuery(context.workspaceId, id))
  });
  const resolvedSystems = queries.flatMap(query =>
    query.data ? [{ publicId: query.data._publicId, name: query.data._name }] : []
  );
  const isLoading = queries.some(query => query.isLoading);
  const isError = queries.some(query => query.isError);
  const state =
    systemIds.length === 0
      ? 'empty'
      : isLoading
        ? 'loading'
        : resolvedSystems.length > 0
          ? 'ready'
          : isError
            ? 'unavailable'
            : 'empty';

  return (
    <div>
      {showLabel && <div className={styles.sectionLabel}>{label}</div>}
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked Systems."
        unavailableMessage="Systems used are unavailable."
      >
        <div className={styles.tags}>
          {resolvedSystems.map(system => (
            <Chip key={system.publicId} tone="ghost">
              {system.name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </div>
  );
};

export const vendorContractEntityDrawerProviderDefinitions = [
  {
    slotId: 'contract.systems-used',
    supports: supportsContractSchema,
    Component: ContractSystemsUsedProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
