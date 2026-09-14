import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useEntityTree } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { entityDetailQuery } from '../../../queries/entities';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { useVendorSpendRollup } from '../useVendorSpendRollup';
import { useVendorAppsSupplied } from '../useVendorAppsSupplied';
import { computeVendorRisk, VENDOR_RISK_BAND_COLOR } from '../vendorRisk';
import { fieldLabel, vendorFieldValue } from '../vendorFieldDisplay';
import type { VendorManagementConfig } from '../vendorManagementQueries';
import styles from './VendorDrawer.module.css';

const RISK_DIMENSION_FIELDS = [
  'security_risk',
  'concentration_risk',
  'financial_risk',
  'compliance_risk',
  'criticality'
] as const;

const ATTRIBUTE_FIELDS = [
  'category',
  'tier',
  'status',
  'relationship_owner',
  'cost_centre'
] as const;

/**
 * Slide-over showing one Vendor's risk profile, attributes, spend, contracts, applications
 * supplied, and best-effort technology lifecycle — mirrors
 * `../../strategy-model/sections/CapabilityDrawer.tsx`. Deep-linkable from the Vendors list
 * (`vendor-management/vendors/$vendorId`).
 *
 * Unlike `CapabilityDrawer`, there's no `onOpen<something>` callback: vendors don't nest, so
 * nothing here re-opens the drawer at a different id.
 */
export const VendorDrawer = ({
  workspaceSlug,
  vendorId,
  vendorConfig,
  onClose
}: {
  workspaceSlug: string;
  vendorId: string;
  vendorConfig: VendorManagementConfig;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  // `vendorId` (the route param) is the entity's *public* id — `entities.get` resolves either
  // public id or internal uid, but the metrics engine and the Contracts tree lookup below are
  // keyed by internal uid only, so every lookup other than this initial fetch uses `uid`.
  const vendor = useQuery(entityDetailQuery(workspaceSlug, vendorId));
  const uid = vendor.data?._uid ?? null;
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const schemas = useSchemas(workspaceSlug);
  const vendorSchema = schemas.data?.find(schema => schema.id === vendorConfig.vendorSchemaId);
  const contractSchema = schemas.data?.find(schema => schema.id === vendorConfig.contractSchemaId);
  // `system-contract` isn't exposed by `resolveVendorManagementConfig` (it's a fixed relation on
  // Contract's own `system` field, not a capability binding) — read its real, per-workspace
  // relation schema id off Contract's `system` typedRelation field.
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  const systemContractRelationSchemaId =
    systemField?.type === 'typedRelation' ? systemField.relationSchemaId : null;

  const spend = useVendorSpendRollup(workspaceSlug, vendorConfig.contractSchemaId, uid);
  const appsSupplied = useVendorAppsSupplied(
    workspaceSlug,
    vendorConfig.vendorSchemaId,
    uid,
    vendorConfig.contractSchemaId,
    systemContractRelationSchemaId
  );

  // Same tree-filter pattern `CapabilityDrawer` uses for its "Children" section, generalized to
  // a cross-schema parent/child pair: `entities.tree` filters returned NODES to `schemaId` while
  // resolving containment edges from the full graph, so fetching the Contract schema's tree and
  // filtering to `edge.parentId === uid` finds this vendor's own Contracts.
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: vendorConfig.contractSchemaId ?? undefined },
    vendorConfig.contractSchemaId != null
  );
  const nodeById = new Map((tree.data?.nodes ?? []).map(node => [node._uid, node]));
  const contracts = (tree.data?.edges ?? [])
    .filter(edge => edge.parentId === uid)
    .map(edge => nodeById.get(edge.childId))
    .filter((node): node is NonNullable<typeof node> => node != null);

  if (vendor.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading vendor…</div>
      </Drawer>
    );
  }
  if (vendor.isError || !vendor.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This vendor is unavailable.</div>
      </Drawer>
    );
  }

  const entity = vendor.data;
  const risk = computeVendorRisk({
    security_risk: typeof entity.security_risk === 'number' ? entity.security_risk : null,
    concentration_risk:
      typeof entity.concentration_risk === 'number' ? entity.concentration_risk : null,
    financial_risk: typeof entity.financial_risk === 'number' ? entity.financial_risk : null,
    compliance_risk: typeof entity.compliance_risk === 'number' ? entity.compliance_risk : null,
    criticality: typeof entity.criticality === 'number' ? entity.criticality : null
  });

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        <>
          {typeof entity.tier === 'string' && <Chip tone="ghost">{entity.tier}</Chip>}
          {typeof entity.status === 'string' && <Chip tone="ghost">{entity.status}</Chip>}
        </>
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Risk profile</div>
      <div className={styles.statGrid}>
        {RISK_DIMENSION_FIELDS.map(fieldId => (
          <div className={styles.stat} key={fieldId}>
            <div className={styles.statLabel}>{fieldLabel(vendorSchema, fieldId)}</div>
            <div className={styles.statValue}>
              {vendorFieldValue(vendorSchema, entity, fieldId)}
            </div>
          </div>
        ))}
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

      <div className={styles.sectionLabel}>Attributes</div>
      {ATTRIBUTE_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(vendorSchema, fieldId)}</span>
          <span>{vendorFieldValue(vendorSchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>Spend</div>
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

      <div className={styles.sectionLabel}>Contracts</div>
      {tree.isLoading ? (
        <span className="dim">Loading…</span>
      ) : contracts.length > 0 ? (
        contracts.map(contract => (
          <div className={styles.attributeRow} key={contract._uid}>
            <span className={styles.attributeLabel}>{contract._name}</span>
            <span>{vendorFieldValue(contractSchema, contract, 'annual_cost')}</span>
          </div>
        ))
      ) : (
        <span className="dim">No contracts.</span>
      )}

      <div className={styles.sectionLabel}>Applications supplied</div>
      {appsSupplied.isLoading ? (
        <span className="dim">Loading…</span>
      ) : appsSupplied.items.length > 0 ? (
        <div className={styles.tags}>
          {appsSupplied.items.map(({ system, contract }) => (
            <Chip key={system._uid} tone="ghost" title={`via ${contract._name}`}>
              {system._name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No linked applications, via any contract.</span>
      )}

      <div className={styles.sectionLabel}>
        Technology lifecycle
        <span className={styles.sectionCaption}>Derived from linked Systems' lifecycle state.</span>
      </div>
      {appsSupplied.isLoading ? (
        <span className="dim">Loading…</span>
      ) : appsSupplied.items.length > 0 ? (
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
      ) : (
        <span className="dim">No linked Systems to derive a lifecycle state from.</span>
      )}

      <div className={styles.sectionLabel}>Capabilities funded</div>
      <span className="dim">Not yet available — no linked capability data yet.</span>
    </Drawer>
  );
};
