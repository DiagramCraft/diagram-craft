// Evaluated for migration onto the `typed-relation-list` drawer item (#3403/#3404) and
// intentionally excluded: none of these slots directly filter a typedRelation field declared on
// the Vendor schema itself — they're all indirect joins (e.g. Vendor -> Contract -> System) or
// computed roll-ups, which the new item kind doesn't represent.
import { useQuery } from '@tanstack/react-query';
import { StatusChip } from '../../../components/StatusChip';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps,
  type EntityDrawerRequiredField
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { useVendorAppsSupplied } from '../useVendorAppsSupplied';
import styles from './VendorDrawer.module.css';

const VENDOR_REQUIRED_FIELDS = [
  { id: 'category' },
  { id: 'tier' },
  { id: 'status' },
  { id: 'relationship_owner' },
  { id: 'cost_centre' },
  { id: 'security_risk' },
  { id: 'concentration_risk' },
  { id: 'financial_risk' },
  { id: 'compliance_risk' },
  { id: 'criticality' }
] satisfies readonly EntityDrawerRequiredField[];

const useVendorProviderConfiguration = (workspaceId: string) => {
  const query = useQuery(workspaceCapabilityConfigurationsQuery(workspaceId));
  return { query, config: resolveVendorManagementConfig(query.data) };
};

const systemContractRelationSchemaId = (
  context: EntityDrawerProviderContext,
  contractSchemaId: string | null
): string | null => {
  const contractSchema = context.schemas.find(schema => schema.id === contractSchemaId);
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  return systemField?.type === 'typedRelation' ? systemField.relationSchemaId : null;
};

const VendorTechnologyLifecycleProvider = ({ context }: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useVendorProviderConfiguration(context.workspaceId);
  const relationSchemaId = systemContractRelationSchemaId(
    context,
    config?.contractSchemaId ?? null
  );
  const appsSupplied = useVendorAppsSupplied(
    context.workspaceId,
    config?.vendorSchemaId ?? null,
    context.entity._uid,
    config?.contractSchemaId ?? null,
    relationSchemaId
  );
  const { data: lifecycleStates = [] } = useLifecycleStates(context.workspaceId);
  const state =
    configurationQuery.isLoading || appsSupplied.isLoading
      ? 'loading'
      : configurationQuery.isError
        ? 'unavailable'
        : appsSupplied.error
          ? 'unavailable'
          : appsSupplied.items.length > 0
            ? 'ready'
            : 'empty';

  return (
    <>
      <div className={styles.sectionCaption}>Derived from linked Systems' lifecycle state.</div>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked Systems to derive a lifecycle state from."
        unavailableMessage="Technology lifecycle is unavailable."
      >
        <div className={styles.tags}>
          {appsSupplied.items.map(({ system }) =>
            system._lifecycle ? (
              <span key={system._uid} className={styles.lifecycleRow}>
                {system._name}
                <StatusChip value={system._lifecycle.id} lifecycleStates={lifecycleStates} />
              </span>
            ) : null
          )}
        </div>
      </EntityDrawerProviderStatus>
    </>
  );
};

export const vendorEntityDrawerProviderDefinitions = [
  {
    slotId: 'vendor.technology-lifecycle',
    requiredFields: VENDOR_REQUIRED_FIELDS,
    Component: VendorTechnologyLifecycleProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
