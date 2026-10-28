import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useMilestones } from '../../../hooks/useMilestones';
import { formatDate } from '../../../utils/dateFormat';
import { useEntityDrawer } from '../entityDrawer/useEntityDrawer';
import pageStyles from '../EntityDetailScreen.module.css';
import {
  getSnapshotEffectiveDate,
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
  const { openPlannedChangeDrawer } = useEntityDrawer();
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
    return (
      <EmptyState dense title="No planned changes" subtitle="Planned changes will appear here." />
    );
  }

  const effectiveDate = (entry: (typeof futureEntries)[number]) =>
    getSnapshotEffectiveDate(entry.changeCase, milestonesById);
  const sortedEntries = [...futureEntries].sort((a, b) => {
    const aDate = effectiveDate(a);
    const bDate = effectiveDate(b);
    if (aDate === bDate) return 0;
    if (aDate == null) return 1;
    if (bDate == null) return -1;
    return aDate.localeCompare(bDate);
  });

  return (
    <div className={pageStyles.futurePlansPage}>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Date</Table.HeaderCell>
            <Table.HeaderCell>Project</Table.HeaderCell>
            <Table.HeaderCell>Milestone</Table.HeaderCell>
            <Table.HeaderCell>Note</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sortedEntries.map(entry => {
            const projectName =
              entityProjects.find(ep => ep.project.id === entry.changeCase.project_id)?.project
                .name ?? entry.changeCase.project_id;
            const date = effectiveDate(entry);
            const milestoneName = entry.changeCase.milestone_id
              ? milestonesById.get(entry.changeCase.milestone_id)?.name
              : null;

            return (
              <Table.Row
                key={entry.member.id}
                onClick={
                  entry.changeCase.project_id
                    ? () =>
                        openPlannedChangeDrawer({
                          projectId: entry.changeCase.project_id ?? '',
                          caseId: entry.changeCase.id,
                          memberId: entry.member.id
                        })
                    : undefined
                }
              >
                <Table.Cell>{date ? formatDate(date) : '—'}</Table.Cell>
                <Table.Cell>{projectName ?? '—'}</Table.Cell>
                <Table.Cell>{milestoneName ?? '—'}</Table.Cell>
                <Table.Cell>{entry.changeCase.commit_message ?? '—'}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
