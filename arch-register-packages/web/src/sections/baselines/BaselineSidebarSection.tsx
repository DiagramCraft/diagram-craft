import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { Baseline } from '@arch-register/api-types/baselineContract';
import { TbBookmark } from 'react-icons/tb';
import { useBaselines } from '../../hooks/useBaselines';
import { SidebarGroupLabel } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import { baselineContextSearch } from './baselineContext';

type BaselineSidebarSectionProps = {
  workspaceSlug: string;
  kind: 'workspace' | 'project';
  projectId?: string | null;
};

const sortBaselines = (baselines: Baseline[]) =>
  [...baselines].sort(
    (left, right) => Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt)
  );

export const BaselineSidebarSection = ({
  workspaceSlug,
  kind,
  projectId
}: BaselineSidebarSectionProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown> & {
    baselineId?: string;
  };
  const { data: baselines = [], isLoading, error } = useBaselines(workspaceSlug);
  const visibleBaselines = useMemo(() => {
    if (kind === 'project') {
      if (!projectId) return [];
      return sortBaselines(
        baselines.filter(
          baseline =>
            baseline.scope.source.kind === 'project' &&
            baseline.scope.source.projectId === projectId
        )
      );
    }
    return sortBaselines(baselines.filter(baseline => baseline.scope.source.kind !== 'project'));
  }, [baselines, kind, projectId]);

  const openBaseline = (baseline: Baseline) => {
    const contextSearch = baselineContextSearch(baseline);
    if (kind === 'project' && projectId) {
      navigate({
        ...projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)),
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          section: 'entities' as const,
          ...contextSearch,
          asOf: undefined,
          asOfIncludeProjects: undefined
        })
      });
      return;
    }
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...contextSearch,
        asOf: undefined,
        asOfIncludeProjects: undefined
      })
    });
  };

  const activeBaselineId = search.baselineId;

  return (
    <section>
      <SidebarGroupLabel>
        {kind === 'project' ? 'Project baselines' : 'Workspace baselines'}
      </SidebarGroupLabel>
      {isLoading && <div className={`${styles.emptyState} dim`}>Loading baselines…</div>}
      {!isLoading && error && (
        <div className={`${styles.emptyState} dim`}>Could not load baselines.</div>
      )}
      {!isLoading && !error && visibleBaselines.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No baselines yet.</div>
      )}
      {visibleBaselines.map(baseline => (
        <TreeRow
          key={baseline.id}
          testId={`${kind}-baseline-${baseline.id}`}
          icon={<TbBookmark size={12} />}
          label={baseline.name}
          active={activeBaselineId === baseline.id}
          onClick={() => openBaseline(baseline)}
          trailing={<span className="dim">{baseline.status}</span>}
        />
      ))}
    </section>
  );
};
