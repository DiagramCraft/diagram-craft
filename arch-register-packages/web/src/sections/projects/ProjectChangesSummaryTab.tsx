import { useMemo, useState } from 'react';
import type { EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { Project } from '@arch-register/api-types/projectContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Select } from '@diagram-craft/app-components/Select';
import { EmptyState } from '../../components/EmptyState';
import { useChangeCasesByProject } from '../../hooks/useChangeCases';
import { useEntityLandscapeDiff } from '../../hooks/useEntities';
import { useMilestones } from '../../hooks/useMilestones';
import { EntityLandscapeDiffTable } from '../entities/components/EntityLandscapeDiffTable';
import { getProjectScenarioDate, toMilestonesById } from '../entities/components/snapshotDisplay';
import { formatDate } from '../../utils/dateFormat';
import styles from './ProjectChangesSummaryTab.module.css';

type SchemaInfo = { color: string; icon: string | null };
const NO_COMPARISON_PROJECT = '__no-comparison-project__';

export const ProjectChangesSummaryTab = ({
  workspaceId,
  project,
  projects,
  diff,
  isLoading,
  targetDate,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  includeOverdueChanges,
  onIncludeOverdueChangesChange
}: {
  workspaceId: string;
  project: Project;
  projects: Project[];
  diff: EntityLandscapeDiff | undefined;
  isLoading: boolean;
  targetDate: string | null;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  includeOverdueChanges: boolean;
  onIncludeOverdueChangesChange: (include: boolean) => void;
}) => {
  const [comparisonProjectId, setComparisonProjectId] = useState<string | null>(null);
  const comparisonProject = projects.find(
    projectOption => projectOption.id === comparisonProjectId
  );
  const { data: comparisonChangeCases = [] } = useChangeCasesByProject(
    workspaceId,
    comparisonProjectId ?? '',
    comparisonProjectId != null
  );
  const { data: comparisonMilestones = [] } = useMilestones(
    workspaceId,
    comparisonProjectId ?? undefined,
    comparisonProjectId != null
  );
  const comparisonMilestonesById = useMemo(
    () => toMilestonesById(comparisonMilestones),
    [comparisonMilestones]
  );
  const comparisonTargetDate = comparisonProject
    ? getProjectScenarioDate(
        comparisonProject.target_date,
        comparisonChangeCases,
        comparisonMilestonesById
      )
    : null;
  const comparisonStates = useMemo(() => {
    if (!comparisonProject || !targetDate || !comparisonTargetDate) return null;
    return {
      from: {
        asOf: targetDate,
        projectId: project.id,
        projectScope: 'all' as const,
        includePlannedChanges: true,
        includeOverdueChanges
      },
      to: {
        asOf: comparisonTargetDate,
        projectId: comparisonProject.id,
        projectScope: 'all' as const,
        includePlannedChanges: true,
        includeOverdueChanges
      }
    };
  }, [comparisonProject, comparisonTargetDate, includeOverdueChanges, project.id, targetDate]);
  const { data: comparisonDiff, isLoading: isComparisonLoading } = useEntityLandscapeDiff(
    workspaceId,
    comparisonStates?.from ?? null,
    comparisonStates?.to ?? null,
    comparisonProjectId != null
  );

  const availableProjects = projects.filter(projectOption => projectOption.id !== project.id);

  const comparisonControls = (
    <div className={styles.comparisonControls}>
      <Select.Root
        value={comparisonProjectId ?? ''}
        onChange={value =>
          setComparisonProjectId(value === NO_COMPARISON_PROJECT ? null : (value ?? null))
        }
        placeholder={
          availableProjects.length > 0 ? 'Compare with another project' : 'No other projects'
        }
      >
        <Select.Item value={NO_COMPARISON_PROJECT}>No project</Select.Item>
        {availableProjects.map(projectOption => (
          <Select.Item key={projectOption.id} value={projectOption.id}>
            {projectOption.name}
          </Select.Item>
        ))}
      </Select.Root>
    </div>
  );

  if (comparisonProjectId != null) {
    if (!comparisonProject || !targetDate || !comparisonTargetDate) {
      return (
        <div className={styles.wrap}>
          <div className={styles.header}>{comparisonControls}</div>
          <EmptyState
            title="No comparison date"
            subtitle="Both projects need a planned-change date or project end date to compare their future states."
          />
        </div>
      );
    }

    if (isComparisonLoading || !comparisonDiff) {
      return (
        <div className={styles.wrap}>
          <div className={styles.header}>{comparisonControls}</div>
          <div>Loading…</div>
        </div>
      );
    }

    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {project.name} vs. {comparisonProject.name}
          </div>
          <div className={styles.headerCounts}>
            {formatDate(targetDate)} vs. {formatDate(comparisonTargetDate)} ·{' '}
            {comparisonDiff.added.length} only in {comparisonProject.name} ·{' '}
            {comparisonDiff.removed.length} only in {project.name} · {comparisonDiff.changed.length}{' '}
            different
          </div>
          <label className={styles.overdueToggle}>
            <Checkbox
              value={includeOverdueChanges}
              onChange={v => onIncludeOverdueChangesChange(v ?? false)}
            />
            <span>Overdue changes</span>
          </label>
          {comparisonControls}
        </div>
        <EntityLandscapeDiffTable
          diff={comparisonDiff}
          schemaMap={schemaMap}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          addedTitle={`Only in ${comparisonProject.name}`}
          removedTitle={`Only in ${project.name}`}
          currentValueLabel="Current value"
          fromValueLabel={project.name}
          toValueLabel={comparisonProject.name}
        />
      </div>
    );
  }

  if (!targetDate) {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>{comparisonControls}</div>
        <EmptyState
          title="No comparison date"
          subtitle="This project needs a planned-change date or project end date to compare against the current state."
        />
      </div>
    );
  }

  if (isLoading || !diff) {
    return <div className={styles.wrap}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>What&apos;s changed by {formatDate(targetDate)}</div>
        <div className={styles.headerCounts}>
          {diff.added.length} added &middot; {diff.removed.length} removed &middot;{' '}
          {diff.changed.length} changed
        </div>
        <label className={styles.overdueToggle}>
          <Checkbox
            value={includeOverdueChanges}
            onChange={v => onIncludeOverdueChangesChange(v ?? false)}
          />
          <span>Overdue changes</span>
        </label>
        {comparisonControls}
      </div>

      <EntityLandscapeDiffTable
        diff={diff}
        schemaMap={schemaMap}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
    </div>
  );
};
