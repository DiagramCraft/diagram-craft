import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { EmptyState } from '../../../components/EmptyState';
import { useMilestones } from '../../../hooks/useMilestones';
import { formatDate } from '../../../utils/dateFormat';
import styles from './EntityOverviewTab.module.css';
import pageStyles from '../EntityDetailScreen.module.css';
import {
  getSnapshotDateLabel,
  toMilestonesById,
  flattenChangeCaseMembers
} from './snapshotDisplay';

type EntityProject = { project: Project; entity_type: ProjectEntity['entity_type'] };

export const EntityFuturePlansTab = ({
  workspaceId,
  entityProjects,
  changeCases
}: {
  workspaceId: string;
  entityProjects: EntityProject[];
  changeCases: ChangeCase[];
}) => {
  const futureEntries = flattenChangeCaseMembers(changeCases).filter(
    entry => entry.changeCase.status === 'planned'
  );
  const futureSnapshotProjectIds = [
    ...new Set(
      futureEntries
        .map(entry => entry.changeCase.project_id)
        .filter((id): id is string => id != null)
    )
  ];
  const { data: milestones = [] } = useMilestones(workspaceId);
  const milestonesById = toMilestonesById(
    milestones.filter(milestone => futureSnapshotProjectIds.includes(milestone.project_id))
  );

  if (futureEntries.length === 0) {
    return <EmptyState title="No future plans" subtitle="Planned changes will appear here." />;
  }

  return (
    <div className={pageStyles.futurePlansPage}>
      {futureEntries.map(entry => {
        const projectName =
          entityProjects.find(ep => ep.project.id === entry.changeCase.project_id)?.project.name ??
          entry.changeCase.project_id;
        const dateLabel = entry.changeCase.milestone_id
          ? getSnapshotDateLabel(entry.changeCase, milestonesById)
          : entry.changeCase.target_date
            ? formatDate(entry.changeCase.target_date)
            : null;

        return (
          <div key={entry.member.id} className={styles.futurePlan}>
            <div className={styles.futurePlanMeta}>
              <span className={styles.futurePlanProject}>{projectName}</span>
              {dateLabel && <span className={styles.futurePlanDate}>{dateLabel}</span>}
            </div>
            {entry.changeCase.commit_message && (
              <div className={styles.futurePlanNote}>{entry.changeCase.commit_message}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
