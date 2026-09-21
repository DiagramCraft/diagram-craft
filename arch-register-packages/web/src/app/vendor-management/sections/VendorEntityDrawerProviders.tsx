import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { useEntityTree } from '../../../hooks/useEntities';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { useVendorAppsSupplied } from '../useVendorAppsSupplied';
import { useVendorSpendRollup } from '../useVendorSpendRollup';
import { computeVendorRisk, VENDOR_RISK_BAND_COLOR } from '../vendorRisk';
import { vendorFieldValue } from '../vendorFieldDisplay';
import styles from './VendorDrawer.module.css';

const VENDOR_FIELD_IDS = [
  'category',
  'tier',
  'status',
  'relationship_owner',
  'cost_centre',
  'security_risk',
  'concentration_risk',
  'financial_risk',
  'compliance_risk',
  'criticality'
] as const;

const supportsVendorSchema = (context: EntityDrawerProviderContext): boolean =>
  VENDOR_FIELD_IDS.every(fieldId => context.schema.fields.some(field => field.id === fieldId));

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

const ProviderFrame = ({
  label,
  showLabel = true,
  children
}: {
  label: string;
  showLabel?: boolean;
  children?: ReactNode;
}) => (
  <div className={styles.provider}>
    {showLabel && <div className={styles.sectionLabel}>{label}</div>}
    {children}
  </div>
);

const VendorRiskProvider = ({ context, label, showLabel }: EntityDrawerProviderProps) => {
  const risk = computeVendorRisk({
    security_risk:
      typeof context.entity.security_risk === 'number' ? context.entity.security_risk : null,
    concentration_risk:
      typeof context.entity.concentration_risk === 'number'
        ? context.entity.concentration_risk
        : null,
    financial_risk:
      typeof context.entity.financial_risk === 'number' ? context.entity.financial_risk : null,
    compliance_risk:
      typeof context.entity.compliance_risk === 'number' ? context.entity.compliance_risk : null,
    criticality: typeof context.entity.criticality === 'number' ? context.entity.criticality : null
  });

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>vmRisk</div>
          <div className={styles.statValue}>
            {risk.vmRisk != null ? risk.vmRisk.toFixed(1) : '—'}
          </div>
        </div>
      </div>
      {risk.vmRiskBand && (
        <div className={styles.riskBandRow}>
          <Chip dot={VENDOR_RISK_BAND_COLOR[risk.vmRiskBand]} tone="ghost">
            {risk.vmRiskBand}
          </Chip>
        </div>
      )}
    </ProviderFrame>
  );
};

const VendorSpendProvider = ({ context, label, showLabel }: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useVendorProviderConfiguration(context.workspaceId);
  const spend = useVendorSpendRollup(
    context.workspaceId,
    config?.contractSchemaId ?? null,
    context.entity._uid
  );
  const state =
    configurationQuery.isLoading || spend.isLoading
      ? 'loading'
      : configurationQuery.isError || !config
        ? 'unavailable'
        : spend.error
          ? 'unavailable'
          : config.contractSchemaId
            ? 'ready'
            : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No Contract entity schema is bound."
        unavailableMessage="Vendor spend is unavailable."
      >
        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>vmSpend</div>
            <div className={styles.statValue}>
              {spend.vmSpend != null
                ? formatCurrencyValue({ amount: spend.vmSpend, currency: spend.currency })
                : '—'}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Contracts</div>
            <div className={styles.statValue}>{spend.contractCount ?? '—'}</div>
          </div>
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const VendorContractsProvider = ({ context, label, showLabel }: EntityDrawerProviderProps) => {
  const { query: configurationQuery, config } = useVendorProviderConfiguration(context.workspaceId);
  const contractSchemaId = config?.contractSchemaId ?? null;
  const tree = useEntityTree(
    context.workspaceId,
    { schemaId: contractSchemaId ?? undefined },
    contractSchemaId != null
  );
  const nodeById = useMemo(
    () => new Map((tree.data?.nodes ?? []).map(node => [node._uid, node])),
    [tree.data]
  );
  const contracts = useMemo(
    () =>
      (tree.data?.edges ?? [])
        .filter(edge => edge.parentId === context.entity._uid)
        .map(edge => nodeById.get(edge.childId))
        .filter((node): node is NonNullable<typeof node> => node != null),
    [context.entity._uid, nodeById, tree.data]
  );
  const contractSchema = context.schemas.find(schema => schema.id === contractSchemaId);
  const state =
    configurationQuery.isLoading || tree.isLoading
      ? 'loading'
      : configurationQuery.isError
        ? 'unavailable'
        : contractSchemaId == null
          ? 'empty'
          : tree.isError
            ? 'unavailable'
            : contracts.length > 0
              ? 'ready'
              : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No contracts."
        unavailableMessage="Contracts are unavailable."
      >
        {contracts.map(contract => (
          <div className={styles.attributeRow} key={contract._uid}>
            <span className={styles.attributeLabel}>{contract._name}</span>
            <span>{vendorFieldValue(contractSchema, contract, 'annual_cost')}</span>
          </div>
        ))}
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const VendorApplicationsSuppliedProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
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
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No linked applications, via any contract."
        unavailableMessage="Applications supplied are unavailable."
      >
        <div className={styles.tags}>
          {appsSupplied.items.map(({ system, contract }) => (
            <Chip key={system._uid} tone="ghost" title={`via ${contract._name}`}>
              {system._name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const VendorTechnologyLifecycleProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
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
    <ProviderFrame label={label} showLabel={showLabel}>
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
    </ProviderFrame>
  );
};

const VendorCapabilitiesFundedProvider = ({ label, showLabel }: EntityDrawerProviderProps) => (
  <ProviderFrame label={label} showLabel={showLabel}>
    <EntityDrawerProviderStatus
      state="empty"
      emptyMessage="Not yet available — no linked capability data yet."
    />
  </ProviderFrame>
);

export const vendorEntityDrawerProviderDefinitions = [
  {
    slotId: 'vendor.risk',
    supports: supportsVendorSchema,
    Component: VendorRiskProvider
  },
  {
    slotId: 'vendor.spend',
    supports: supportsVendorSchema,
    Component: VendorSpendProvider
  },
  {
    slotId: 'vendor.contracts',
    supports: supportsVendorSchema,
    Component: VendorContractsProvider
  },
  {
    slotId: 'vendor.applications-supplied',
    supports: supportsVendorSchema,
    Component: VendorApplicationsSuppliedProvider
  },
  {
    slotId: 'vendor.technology-lifecycle',
    supports: supportsVendorSchema,
    Component: VendorTechnologyLifecycleProvider
  },
  {
    slotId: 'vendor.capabilities-funded',
    supports: supportsVendorSchema,
    Component: VendorCapabilitiesFundedProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
