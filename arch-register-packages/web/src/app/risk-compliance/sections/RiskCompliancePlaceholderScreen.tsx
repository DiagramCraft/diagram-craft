import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import styles from './RiskCompliancePlaceholderScreen.module.css';

/**
 * Shared capability-config guard + empty state for every Risk & Compliance section. Mirrors
 * `../../vendor-management/sections/VendorManagementPlaceholderScreen.tsx`, but takes its
 * `resolver` as a prop: the Overview/Risks/Controls/Assessments sections gate on the
 * `risk-compliance` capability while the Retention section gates on the separate, generic
 * `retention` capability — both resolved client-side, see `../riskComplianceQueries.ts`.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real risk register / control library / retention / assessments content lands in
 * later sub-issues of #3151.
 */
export const RiskCompliancePlaceholderScreen = ({
  title,
  resolver,
  notEnabledMessage
}: {
  title: string;
  resolver: (
    configurations: readonly WorkspaceCapabilityConfiguration[] | undefined
  ) => unknown;
  notEnabledMessage: string;
}) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading…</div>;
  }

  const config = resolver(configurations.data);
  if (!config) {
    return <div className={styles.empty}>{notEnabledMessage}</div>;
  }

  return (
    <div className={styles.screen}>
      <Title title={title} />
      <div className={styles.empty}>Nothing here yet.</div>
    </div>
  );
};
