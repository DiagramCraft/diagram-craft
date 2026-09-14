import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';
import { VendorDrawer } from './VendorDrawer';
import styles from './VendorManagementPlaceholderScreen.module.css';

/**
 * Minimal Vendors register: a plain list of Vendor entities that opens the shared `VendorDrawer`
 * on row click, deep-linkable at `vendor-management/vendors/$vendorId`. Proves the shared
 * roll-up/drawer model built in #3258 end-to-end with one real consumer — filtering, sorting,
 * and configurable columns are #3259's job, not this one.
 */
export const VendorVendorsScreen = () => {
  const { workspaceSlug, vendorId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    vendorId?: string;
  };
  const navigate = useNavigate();
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);

  const vendors = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: vendorConfig?.vendorSchemaId, view: 'summary', limit: 500 },
      vendorConfig != null
    )
  );

  const openVendor = (id: string) =>
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeVendor = () =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading vendor management…</div>;
  }
  if (!vendorConfig) {
    return (
      <div className={styles.empty}>
        Vendor management is not enabled. Configure the vendor management capability in workspace
        settings.
      </div>
    );
  }

  const items = vendors.data?.items ?? [];

  return (
    <div className={styles.screen}>
      <Title title="Vendors" chips={!vendors.isLoading && <span>{items.length}</span>} />

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Tier</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {items.length === 0 ? (
            <Table.EmptyRow colSpan={3}>
              {vendors.isLoading ? 'Loading vendors…' : 'No vendors yet.'}
            </Table.EmptyRow>
          ) : (
            items.map(entity => (
              <Table.Row key={entity._uid} onClick={() => openVendor(entity._publicId)}>
                <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                <Table.Cell>{typeof entity.tier === 'string' ? entity.tier : '—'}</Table.Cell>
                <Table.Cell>{typeof entity.status === 'string' ? entity.status : '—'}</Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {vendorId && (
        <VendorDrawer
          workspaceSlug={workspaceSlug}
          vendorId={vendorId}
          vendorConfig={vendorConfig}
          onClose={closeVendor}
        />
      )}
    </div>
  );
};
