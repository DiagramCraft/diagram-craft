import { useMemo } from 'react';
import { useAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { filterAssessments, type AssessmentWidgetMode } from './assessmentsWidgetLogic';
import { resolveScopeSchemaIds } from './AssessmentsWidget';
import styles from './AggregateStatWidget.module.css';

export type AssessmentCountWidgetConfig = {
  mode: AssessmentWidgetMode;
  assessmentTypeId?: string;
  /** Entity schema names; counts assessments scoped to any of them. */
  schemaNames?: string[];
  /** Counts open assessments due within this many days, overdue ones included. */
  dueWithinDays?: number;
  label?: string;
  subtext?: string;
};

type Props = {
  config: AssessmentCountWidgetConfig;
};

/** Stat tile counting assessments (workspace-wide) by scope, mode and due window. */
export const AssessmentCountWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: assessments = [], isLoading } = useAssessments(workspaceSlug, true);

  const count = useMemo(
    () =>
      filterAssessments(assessments, {
        mode: config.mode,
        assessmentTypeId: config.assessmentTypeId,
        scopeSchemaIds: resolveScopeSchemaIds(config.schemaNames, schemas),
        dueWithinDays: config.dueWithinDays
      }).length,
    [
      assessments,
      config.assessmentTypeId,
      config.dueWithinDays,
      config.mode,
      config.schemaNames,
      schemas
    ]
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.number}>{count}</div>
      {config.label && <div className={styles.label}>{config.label}</div>}
      {config.subtext && <div className={styles.sub}>{config.subtext}</div>}
    </div>
  );
};
