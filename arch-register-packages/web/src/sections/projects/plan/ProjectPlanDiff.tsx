import { useMemo, useState } from 'react';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Select } from '@diagram-craft/app-components/Select';
import { EmptyState } from '../../../components/EmptyState';
import { useChangeCasesByProject } from '../../../hooks/useChangeCases';
import { buildProjectLandscapeDiffStates, useEntityLandscapeDiff } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { useMilestones } from '../../../hooks/useMilestones';
import { LandscapeDiffTable } from '../../entities/components/LandscapeDiffTable';
import { getProjectScenarioDate, toMilestonesById } from '../../entities/components/snapshotDisplay';
import { formatDate } from '../../../utils/dateFormat';
import styles from './ProjectPlanDiff.module.css';

type SchemaInfo = { color: string; icon: string | null };
const NO_COMPARISON_PROJECT = '__no-comparison-project__';

export const ProjectPlanDiff = ({
  workspaceId,
  project,
  projects,
  targetDate,
  schemaMap,
  schemas,
  lifecycleStates,
  teams
}: {
  workspaceId: string;
  project: Project;
  projects: Project[];
  targetDate: string | null;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const diffStates = useMemo(
    () => (targetDate ? buildProjectLandscapeDiffStates(project.id, targetDate) : null),
    [project.id, targetDate]
  );
  const { data: diff, isLoading } = useEntityLandscapeDiff(
    workspaceId,
    diffStates?.from ?? null,
    diffStates?.to ?? null,
    diffStates != null
  );
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId, true);
  const relationSchemaMap = useMemo(
    () =>
      new Map(
        relationSchemas.map(schema => [
          schema.id,
          { color: schema.color ?? '#888', icon: schema.icon }
        ])
      ),
    [relationSchemas]
  );
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
        includeOverdueChanges: true
      },
      to: {
        asOf: comparisonTargetDate,
        projectId: comparisonProject.id,
        projectScope: 'all' as const,
        includePlannedChanges: true,
        includeOverdueChanges: true
      }
    };
  }, [comparisonProject, comparisonTargetDate, project.id, targetDate]);
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
            Pending project changes compared to {comparisonProject.name} - last change planned for{' '}
            {formatDate(targetDate > comparisonTargetDate ? targetDate : comparisonTargetDate)}
          </div>
          {comparisonControls}
        </div>
        <LandscapeDiffTable
          diff={comparisonDiff}
          schemaMap={schemaMap}
          schemas={schemas}
          relationSchemaMap={relationSchemaMap}
          relationSchemas={relationSchemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          comparison={{ thisName: project.name, otherName: comparisonProject.name }}
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
        <div className={styles.headerTitle}>
          Pending project changes compared to workspace - last change planned for{' '}
          {formatDate(targetDate)}
        </div>
        {comparisonControls}
      </div>

      <LandscapeDiffTable
        diff={diff}
        schemaMap={schemaMap}
        schemas={schemas}
        relationSchemaMap={relationSchemaMap}
        relationSchemas={relationSchemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
      <div className={styles.headerCounts}>
        {diff.added.length} added &middot; {diff.removed.length} removed &middot;{' '}
        {diff.changed.length} changed
        {(diff.relations.added.length > 0 ||
          diff.relations.removed.length > 0 ||
          diff.relations.changed.length > 0) && (
          <>
            {' '}
            &middot; {diff.relations.added.length} relations added &middot;{' '}
            {diff.relations.removed.length} relations removed &middot;{' '}
            {diff.relations.changed.length} relations changed
          </>
        )}
      </div>
    </div>
  );
};
