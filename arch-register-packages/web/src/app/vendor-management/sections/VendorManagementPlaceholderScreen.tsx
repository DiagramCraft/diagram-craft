import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import styles from './VendorManagementPlaceholderScreen.module.css';

/**
 * Shared capability-config guard + empty state for every Vendor Management section. Mirrors
 * `../../strategy-model/sections/StrategyPlaceholderScreen.tsx`, resolving the generic
 * `vendor-management` capability client-side (there is no bespoke `vendor-management.config`
 * endpoint) via `resolveVendorManagementConfig`.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real vendor register / contracts / spend / risk content lands in later sub-issues
 * of #3153.
 */
export const VendorManagementPlaceholderScreen = ({ title }: { title: string }) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading vendor management…</div>;
  }

  const config = resolveVendorManagementConfig(configurations.data);
  if (!config) {
    return (
      <div className={styles.empty}>
        Vendor management is not enabled. Configure the vendor management capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title title={title} />
      <div className={styles.empty}>Nothing here yet.</div>
    </div>
  );
};
