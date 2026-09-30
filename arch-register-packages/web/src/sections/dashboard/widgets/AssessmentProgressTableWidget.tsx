import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { projectsQuery } from '../../../queries/projects';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type {
  EntityAssessmentStatus,
  EntityAssessmentSummary
} from '../../entities/entityDrawer/entityAssessments';
import {
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
  filterAssessmentSummaries
} from './assessmentSummaryLogic';
import { useSchemaAssessmentSummaries } from './useSchemaAssessmentSummaries';
import styles from './AssessmentProgressTableWidget.module.css';

export type AssessmentProgressTableConfig = {
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: string;
  /** Optional: only list assessments in this derived status. */
  status?: EntityAssessmentStatus;
  label?: string;
};

export const AssessmentProgressTableWidget = ({
  config
}: {
  config: AssessmentProgressTableConfig;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemaFound, summaries, isLoading } = useSchemaAssessmentSummaries(
    config.schemaName
  );
  const projects = useQuery(projectsQuery(workspaceSlug));

  const projectsById = useMemo(() => {
    const map = new Map<string, { publicId: string; name: string }>();
    (projects.data ?? []).forEach(project =>
      map.set(project.id, { publicId: project.public_id, name: project.name })
    );
    return map;
  }, [projects.data]);

  const rows = useMemo(
    () =>
      filterAssessmentSummaries(summaries, {
        status: config.status,
        query: '',
        projectNameOf: projectId => projectsById.get(projectId)?.name
      }),
    [summaries, config.status, projectsById]
  );

  const openAssessment = (summary: EntityAssessmentSummary) => {
    const project = projectsById.get(summary.assessment.project_id);
    if (!project) return;
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(project.publicId), {
        section: 'assessments' as const,
        assessmentId: summary.assessment.id
      })
    );
  };

  if (!isLoading && !schemaFound) {
    return (
      <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>
    );
  }

  return (
    <div>
      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Assessment</Table.HeaderCell>
            <Table.HeaderCell>Kind</Table.HeaderCell>
            <Table.HeaderCell>Project</Table.HeaderCell>
            <Table.HeaderCell>Progress</Table.HeaderCell>
            <Table.HeaderCell align="right">Questions</Table.HeaderCell>
            <Table.HeaderCell align="right">Due</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <Table.EmptyRow colSpan={7}>Loading assessments…</Table.EmptyRow>
          ) : rows.length === 0 ? (
            <Table.EmptyRow colSpan={7}>No assessments match these filters.</Table.EmptyRow>
          ) : (
            rows.map(summary => (
              <Table.Row key={summary.assessment.id} onClick={() => openAssessment(summary)}>
                <Table.NameCell
                  title={summary.assessment.name}
                  subtitle={summary.assessment.description || undefined}
                />
                <Table.Cell className="dim">{summary.kind}</Table.Cell>
                <Table.Cell className="dim">
                  {projectsById.get(summary.assessment.project_id)?.name ?? '—'}
                </Table.Cell>
                <Table.Cell>
                  <span className={styles.progress}>
                    <span className={styles.progressTrack}>
                      <span
                        className={styles.progressFill}
                        style={{
                          width: `${Math.round(summary.percent * 100)}%`,
                          background:
                            summary.status === 'overdue'
                              ? ASSESSMENT_STATUS_TONE.overdue
                              : undefined
                        }}
                      />
                    </span>
                    <span className="dim mono">{Math.round(summary.percent * 100)}%</span>
                  </span>
                </Table.Cell>
                <Table.Cell numeric className="dim mono">
                  {summary.questions}
                </Table.Cell>
                <Table.Cell numeric style={{ color: dueTone(summary.due) }}>
                  {dueLabel(summary.due)}
                </Table.Cell>
                <Table.Cell>
                  <Chip tone="ghost" color={ASSESSMENT_STATUS_TONE[summary.status]}>
                    {ASSESSMENT_STATUS_LABEL[summary.status]}
                  </Chip>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
