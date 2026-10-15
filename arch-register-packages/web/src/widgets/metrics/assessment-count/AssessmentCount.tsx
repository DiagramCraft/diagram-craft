import { useMemo } from 'react';
import { useAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { filterAssessments } from '../../data-views/assessments/assessmentsWidgetLogic';
import { resolveScopeSchemaIds } from '../../data-views/assessments/Assessments';
import styles from '../aggregate-stat/AggregateStat.module.css';
import { useWidgetBodyTitle } from '../../shared/dashboard/WidgetBodyTitle';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import { AssessmentCountWidgetConfig } from './types';

type Props = {
  config: AssessmentCountWidgetConfig;
};

/** Stat tile counting assessments (workspace-wide) by scope, mode and due window. */
export const AssessmentCountWidget = ({ config }: Props) => {
  const title = useWidgetBodyTitle();
  const framed = useWidgetFramed();
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
    <div className={`${styles.card} ${framed ? styles.framed : ''}`}>
      <div className={styles.number}>{count}</div>
      {title && <div className={styles.label}>{title}</div>}
      {config.subtext && <div className={styles.sub}>{config.subtext}</div>}
    </div>
  );
};
