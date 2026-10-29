import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { useChangeCasesByRelation } from '../../hooks/useChangeCases';
import { useMilestones } from '../../hooks/useMilestones';
import { useProjects } from '../../hooks/useProjects';
import { formatDate } from '../../utils/dateFormat';
import { diffRelationSnapshotState } from '../entities/components/entityTimelineHelpers';
import {
  flattenRelationChangeCaseMembers,
  getSnapshotDateLabel,
  toMilestonesById
} from '../entities/components/snapshotDisplay';
import styles from '../entities/components/EntityOverviewTab.module.css';

// Planned changes (from project change cases) that include this relation.
export const RelationPlannedChangesSection = ({
  workspaceSlug,
  relation,
  relationSchema
}: {
  workspaceSlug: string;
  relation: RelationRecord;
  relationSchema: RelationSchema | undefined;
}) => {
  const { data: changeCases = [] } = useChangeCasesByRelation(workspaceSlug, relation._uid);
  const { data: projects = [] } = useProjects(workspaceSlug);
  const { data: milestones = [] } = useMilestones(workspaceSlug);
  const milestonesById = toMilestonesById(milestones);

  const entries = flattenRelationChangeCaseMembers(changeCases).filter(
    entry => entry.changeCase.status === 'planned'
  );
  if (entries.length === 0) return <div className="dim">No planned changes</div>;

  return (
    <div>
      {entries.map(({ changeCase, member }) => {
        const projectName =
          projects.find(project => project.id === changeCase.project_id)?.name ??
          changeCase.project_id;
        const dateLabel = changeCase.milestone_id
          ? getSnapshotDateLabel(changeCase, milestonesById)
          : changeCase.target_date
            ? formatDate(changeCase.target_date)
            : null;
        const changes = diffRelationSnapshotState(
          member.base_state,
          member.proposed_state,
          relationSchema ?? null
        );
        return (
          <div key={member.id} className={styles.futurePlan}>
            <div className={styles.futurePlanMeta}>
              <span className={styles.futurePlanProject}>{projectName}</span>
              {dateLabel && <span className={styles.futurePlanDate}>{dateLabel}</span>}
            </div>
            {changeCase.commit_message && (
              <div className={styles.futurePlanNote}>{changeCase.commit_message}</div>
            )}
            {changes.length > 0 ? (
              changes.map(change => (
                <div key={change.label} className="dim">
                  {change.label}: {change.from} → {change.to}
                </div>
              ))
            ) : (
              <div className="dim">Restricted changes</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
