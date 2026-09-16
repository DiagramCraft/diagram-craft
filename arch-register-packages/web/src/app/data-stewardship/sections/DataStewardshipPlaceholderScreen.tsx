import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import styles from './DataStewardshipPlaceholderScreen.module.css';

/**
 * Shared capability-config guard + empty state for every Data Stewardship section. Mirrors
 * `../../vendor-management/sections/VendorManagementPlaceholderScreen.tsx`, resolving the generic
 * `data-stewardship` capability client-side (there is no bespoke `data-stewardship.config`
 * endpoint) via `resolveDataStewardshipConfig`.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real My work / Stewardship / Classification / Change cases & exceptions /
 * Assessments content lands in later sub-issues of #3152.
 */
export const DataStewardshipPlaceholderScreen = ({ title }: { title: string }) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }

  const config = resolveDataStewardshipConfig(configurations.data);
  if (!config) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
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
