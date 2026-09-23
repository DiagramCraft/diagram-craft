import { Chip } from '../../../components/Chip';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { useEntityAssessmentRows } from './useEntityAssessmentRows';
import { ENTITY_ASSESSMENT_STATUS_LABEL } from './entityAssessments';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from './EntityDrawerProviderRegistry';
import styles from './EntityDrawer.module.css';

const AssessmentsProvider = ({ context }: EntityDrawerProviderProps) => {
  const assessments = useEntityAssessmentRows(context.workspaceId, context.schema.id);
  const rows = assessments.rows.filter(row => row.entity._uid === context.entity._uid);
  const state = assessments.isLoading ? 'loading' : rows.length > 0 ? 'ready' : 'empty';

  return (
    <EntityDrawerProviderStatus state={state} emptyMessage="No assessments target this entity.">
      <div className={styles.tags}>
        {rows.map(row => (
          <Chip
            key={row.assessment.id}
            tone="ghost"
            title={`${row.kind} · due ${dueLabel(row.due)}`}
            color={row.status === 'overdue' ? 'var(--cmp-fg-danger, #ef4444)' : undefined}
          >
            {row.kind} — {ENTITY_ASSESSMENT_STATUS_LABEL[row.status]}
            <span className="dim" style={{ marginLeft: 4, color: dueTone(row.due) }}>
              {dueLabel(row.due)}
            </span>
          </Chip>
        ))}
      </div>
    </EntityDrawerProviderStatus>
  );
};

export const entityAssessmentsDrawerProviderDefinitions = [
  {
    slotId: 'entity.assessments',
    Component: AssessmentsProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
