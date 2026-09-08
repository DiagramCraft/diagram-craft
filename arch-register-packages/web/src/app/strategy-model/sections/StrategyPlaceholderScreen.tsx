import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import styles from './StrategyPlaceholderScreen.module.css';

/**
 * Shared capability-config guard + empty state for every Strategy & Capability Modelling section.
 * Mirrors `../../business-glossary/sections/GlossaryScreen.tsx`'s `isLoading` / `!config.data`
 * guard, but resolves the generic `strategy-model` capability client-side (there is no bespoke
 * `strategy.config` endpoint) via `resolveStrategyModelConfig`.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real capability-map / heatmap / traceability content lands in later sub-issues of
 * #3149.
 */
export const StrategyPlaceholderScreen = ({ title }: { title: string }) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading strategy model…</div>;
  }

  const config = resolveStrategyModelConfig(configurations.data);
  if (!config) {
    return (
      <div className={styles.empty}>
        The strategy model is not enabled. Configure the strategy model capability in workspace
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
