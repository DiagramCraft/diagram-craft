import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { entityDetailQuery } from '../../../queries/entities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { firstScalarValue, scalarValues } from '../../../lib/scalarFieldValues';
import { formatDate } from '../../../utils/dateFormat';
import { fieldLabel, vendorFieldValue } from '../vendorFieldDisplay';
import { renewalWindow, RENEWAL_WINDOWS, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';
import type { VendorManagementConfig } from '../vendorManagementQueries';
import styles from './VendorDrawer.module.css';

const TERM_FIELDS = [
  'contract_type',
  'notice_period_days',
  'auto_renew',
  'contract_owner'
] as const;

const RENEWAL_WINDOW_LABEL = new Map(RENEWAL_WINDOWS.map(window => [window.id, window.label]));

/**
 * Slide-over showing one Contract's terms, cost, linked Vendor, and Systems used — mirrors
 * `VendorDrawer.tsx`. Deep-linkable from the Contracts list/calendar
 * (`vendor-management/contracts/$contractId`), consistent with how Vendors already opens its own
 * drawer rather than navigating away to the generic Entities app.
 *
 * The Vendor row opens the shared `VendorDrawer` (navigates within the Vendors section) rather
 * than the generic entity detail page — Systems used links out to the generic Entities app since
 * there's no System drawer in this app.
 */
export const ContractDrawer = ({
  workspaceSlug,
  contractId,
  vendorConfig,
  onClose
}: {
  workspaceSlug: string;
  contractId: string;
  vendorConfig: VendorManagementConfig;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const contract = useQuery(entityDetailQuery(workspaceSlug, contractId));
  const schemas = useSchemas(workspaceSlug);
  const contractSchema = schemas.data?.find(schema => schema.id === vendorConfig.contractSchemaId);

  // `vendor` is a containment field (bare parent uid, wrapped in an array — see
  // `useVendorContracts.ts`'s own comment on this); `system` is a typedRelation, potentially
  // many ids. Both are batch-resolved to name/publicId in one call via `useEntitiesByIds`.
  const vendorId = contract.data
    ? (firstScalarValue(contract.data.vendor) as string | undefined)
    : undefined;
  const systemIds = contract.data ? (scalarValues(contract.data.system) as string[]) : [];
  const linkedIds = [vendorId, ...systemIds].filter((id): id is string => !!id);
  const linked = useEntitiesByIds(workspaceSlug, linkedIds);
  const vendor = vendorId ? linked.get(vendorId) : undefined;
  const systems = systemIds
    .map(id => linked.get(id))
    .filter((system): system is { name: string; publicId: string } => system != null);

  const openVendor = () =>
    vendor &&
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId: vendor.publicId },
      search: (previous: Record<string, unknown>) => previous
    });

  if (contract.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading contract…</div>
      </Drawer>
    );
  }
  if (contract.isError || !contract.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This contract is unavailable.</div>
      </Drawer>
    );
  }

  const entity = contract.data;
  const contractWindow = renewalWindow(
    typeof entity.contract_end === 'string' ? entity.contract_end : null
  );

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        <>
          {typeof entity.contract_type === 'string' && (
            <Chip tone="ghost">
              {vendorFieldValue(contractSchema, entity, 'contract_type')}
            </Chip>
          )}
          <Chip dot={RENEWAL_WINDOW_COLOR[contractWindow]} tone="ghost">
            {RENEWAL_WINDOW_LABEL.get(contractWindow)}
          </Chip>
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
      <div className={styles.sectionLabel}>Vendor</div>
      {vendor ? (
        <button type="button" className={styles.attributeRow} onClick={openVendor}>
          <span className={styles.attributeLabel}>Provided by</span>
          <span>{vendor.name} →</span>
        </button>
      ) : (
        <span className="dim">No vendor linked.</span>
      )}

      <div className={styles.sectionLabel}>Terms</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>{fieldLabel(contractSchema, 'contract_start')}</span>
        <span>{formatDate(entity.contract_start)}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>{fieldLabel(contractSchema, 'contract_end')}</span>
        <span>{formatDate(entity.contract_end)}</span>
      </div>
      {TERM_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(contractSchema, fieldId)}</span>
          <span>{vendorFieldValue(contractSchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>Cost</div>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Annual cost</div>
          <div className={styles.statValue}>
            {vendorFieldValue(contractSchema, entity, 'annual_cost')}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Setup fee</div>
          <div className={styles.statValue}>
            {vendorFieldValue(contractSchema, entity, 'setup_fee')}
          </div>
        </div>
      </div>

      <div className={styles.sectionLabel}>Systems used</div>
      {systems.length > 0 ? (
        <div className={styles.tags}>
          {systems.map(system => (
            <Chip key={system.publicId} tone="ghost">
              {system.name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No linked Systems.</span>
      )}
    </Drawer>
  );
};
