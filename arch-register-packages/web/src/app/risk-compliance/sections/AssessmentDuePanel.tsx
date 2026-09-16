import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { dueLabel, dueTone } from './assessmentDueTone';
import styles from './AssessmentDuePanel.module.css';

const MAX_ITEMS = 5;

export type AssessmentDuePanelProject = { publicId: string; name: string };

const sortByDueDate = (assessments: Assessment[]): Assessment[] =>
  [...assessments].sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));

/**
 * One "due soon" panel — open, due-dated assessments in a given scope (risk reviews or control
 * tests), soonest first, capped with a "+N more" footer. Mirrors the design reference's
 * `RCAssessments` due-panel rows (`rc-views.jsx`): a name/subtitle line, a day-count due label
 * ("18d" / "6d late", coloured via `dueTone`) rather than a plain formatted date — the subtitle is
 * the assessment's owning project name, the closest analog this shipped model has to the design's
 * risk/control ref+owner subtitle. Renders nothing (not an empty state) when there's nothing due,
 * so an unused panel doesn't take up space next to a busy one.
 */
export const AssessmentDuePanel = ({
  title,
  assessments,
  projectsById,
  onOpenAssessment
}: {
  title: string;
  assessments: Assessment[];
  projectsById: Map<string, AssessmentDuePanelProject>;
  onOpenAssessment: (assessmentId: string) => void;
}) => {
  const due = sortByDueDate(
    assessments.filter(assessment => assessment.status === 'open' && assessment.due_at !== null)
  );

  if (due.length === 0) return null;

  const shown = due.slice(0, MAX_ITEMS);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{title}</span>
        <span className="dim mono">{due.length}</span>
      </div>
      <div className={styles.list}>
        {shown.map(assessment => (
          <button
            key={assessment.id}
            type="button"
            className={styles.row}
            onClick={() => onOpenAssessment(assessment.id)}
          >
            <span className={styles.rowMain}>
              <span className={styles.rowLabel}>{assessment.name}</span>
              <span className={`${styles.rowSub} dim mono`}>
                {projectsById.get(assessment.project_id)?.name ?? '—'}
              </span>
            </span>
            <span
              className={`${styles.rowMeta} mono`}
              style={{ color: dueTone(assessment.due_at) }}
            >
              {dueLabel(assessment.due_at)}
            </span>
          </button>
        ))}
        {due.length > MAX_ITEMS && (
          <div className={`${styles.footer} dim`}>+{due.length - MAX_ITEMS} more</div>
        )}
      </div>
    </div>
  );
};
