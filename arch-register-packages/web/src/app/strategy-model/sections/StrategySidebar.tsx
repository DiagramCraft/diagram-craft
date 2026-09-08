import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import {
  STRATEGY_RAIL_PATHS,
  STRATEGY_SECTIONS,
  type StrategyRailItemId
} from '../strategySections';
import styles from '../../../shell/SidePanel.module.css';

/**
 * Section-dependent primary sidebar for the Strategy & Capability Modelling app: navigation
 * between the app's five rail sections, gated on the `strategy-model` capability configuration
 * (mirrors `../../business-glossary/sections/GlossarySidebar.tsx`'s `!enabled` empty state).
 */
export const StrategySidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: StrategyRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveStrategyModelConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="Strategy" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Strategy model is not enabled.</div>
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {STRATEGY_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`strategy-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: STRATEGY_RAIL_PATHS[section.id],
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
