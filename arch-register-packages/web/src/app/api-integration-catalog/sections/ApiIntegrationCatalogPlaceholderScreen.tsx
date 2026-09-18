import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import styles from './ApiIntegrationCatalogPlaceholderScreen.module.css';

/**
 * Shared capability-config guard + empty state for every API & Integration Catalog section.
 * Mirrors `../../data-stewardship/sections/DataStewardshipPlaceholderScreen.tsx`, resolving the
 * existing `api-specification` capability (#2826) client-side via
 * `resolveApiIntegrationCatalogConfig`.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real Overview / Impact content lands in later sub-issues of #3150 (#3316-#3320).
 */
export const ApiIntegrationCatalogPlaceholderScreen = ({ title }: { title: string }) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading API & Integration Catalog…</div>;
  }

  const config = resolveApiIntegrationCatalogConfig(configurations.data);
  if (!config) {
    return (
      <div className={styles.empty}>
        API & Integration Catalog is not enabled. Configure the API specification capability in
        workspace settings.
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
