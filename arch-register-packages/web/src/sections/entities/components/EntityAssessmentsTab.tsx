import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbChevronRight, TbExternalLink } from 'react-icons/tb';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import { useProjects } from '../../../hooks/useProjects';
import { useAssessmentsForProjects } from '../../../hooks/useAssessments';
import { useAssessmentResponses, useUpsertAssessmentResponse } from '../../../hooks/useAssessmentResponses';
import { AssessmentFieldCell } from '../../projects/components/AssessmentFieldCells';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import styles from './EntityAssessmentsTab.module.css';

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete'
} as const;

export const EntityAssessmentsTab = ({
  workspaceId,
  entity,
  schema
}: {
  workspaceId: string;
  entity: EntityRecord;
  schema: EntitySchema | null;
}) => {
  // Assessment scope is defined by entity schema/type, not by explicit project membership
  // (matches how the bulk fill grid resolves in-scope entities) — so candidate assessments
  // come from every project the user can access, not just projects this entity is linked to.
  const { data: projects = [] } = useProjects(workspaceId);
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const assessmentQueries = useAssessmentsForProjects(workspaceId, projectIds);

  const relevant = useMemo(() => {
    if (!schema) return [];
    const result: {
      assessment: Assessment;
      projectId: string;
      projectName: string;
      projectPublicId: string;
    }[] = [];
    assessmentQueries.forEach((q, i) => {
      const projectId = projectIds[i];
      const projectName = projects[i]?.name ?? '';
      const projectPublicId = projects[i]?.public_id ?? '';
      (q.data ?? []).forEach(assessment => {
        if (
          (assessment.status === 'open' || assessment.status === 'closed') &&
          assessment.scope.includes(schema.id)
        ) {
          result.push({ assessment, projectId: projectId!, projectName, projectPublicId });
        }
      });
    });
    return result;
  }, [assessmentQueries, projectIds, projects, schema]);

  if (relevant.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No open assessments</div>
        <div className={styles.emptySub}>
          {schema?.name ?? 'This entity type'} isn't in scope for any open or closed assessment.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {relevant.map(({ assessment, projectId, projectName, projectPublicId }) => (
        <AssessmentFillCard
          key={assessment.id}
          workspaceId={workspaceId}
          projectId={projectId}
          projectName={projectName}
          projectPublicId={projectPublicId}
          assessment={assessment}
          entityId={entity._uid}
        />
      ))}
    </div>
  );
};

const AssessmentFillCard = ({
  workspaceId,
  projectId,
  projectName,
  projectPublicId,
  assessment,
  entityId
}: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  projectPublicId: string;
  assessment: Assessment;
  entityId: string;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: responses = [] } = useAssessmentResponses(workspaceId, projectId, assessment.id);
  const upsertResponse = useUpsertAssessmentResponse(workspaceId, projectId, assessment.id, assessment.fields);

  const response = responses.find(r => r.entity_id === entityId);
  const status = response?.status ?? computeAssessmentStatus(assessment.fields, undefined);

  const goToAssessment = () => {
    if (!projectPublicId) return;
    navigate(
      projectDetailRoute(workspaceId, asProjectPublicId(projectPublicId), {
        section: 'assessments',
        assessmentId: assessment.id
      })
    );
  };

  return (
    <div className={styles.card}>
      <button type="button" className={`${styles.head} ${open ? styles.headOpen : ''}`} onClick={() => setOpen(o => !o)}>
        <div className={styles.headBody}>
          <div className={styles.name}>{assessment.name}</div>
          {projectName && <div className={styles.proj}>{projectName}</div>}
        </div>
        <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
        {STATUS_LABEL[status]}
        <TbChevronRight size={12} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      {open && (
        <div className={styles.body}>
          <div className={styles.viewLinkRow}>
            <button type="button" className={styles.viewLink} onClick={goToAssessment}>
              <TbExternalLink size={11} /> View in Assessments
            </button>
          </div>
          {assessment.fields.map(field => (
            <div key={field.id} className={styles.row}>
              <div className={styles.label}>
                {field.label}
                {field.requirementLevel === 'required' && <span className={styles.req}> *</span>}
              </div>
              <div className={styles.value}>
                <AssessmentFieldCell
                  field={field}
                  value={response?.values[field.id]}
                  disabled={assessment.status !== 'open'}
                  onChange={value =>
                    upsertResponse.mutate({ entityId, values: { [field.id]: value } })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
