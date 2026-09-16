/**
 * Day-count due-date idiom shared by `RiskComplianceAssessmentsScreen.tsx`'s register and
 * `AssessmentDuePanel.tsx` — mirrors the design reference's `rcDueTone`/day-count labels
 * (`rc-data.jsx`, `rc-views.jsx`'s `RCAssessments`): "18d" / "6d late" rather than a plain
 * formatted date, coloured danger/warning/ok by how close (or past) the due date is.
 */
const daysUntil = (dueAt: string): number =>
  Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);

export const dueLabel = (dueAt: string | null): string => {
  if (dueAt === null) return '—';
  const days = daysUntil(dueAt);
  return days < 0 ? `${Math.abs(days)}d late` : `${days}d`;
};

export const dueTone = (dueAt: string | null): string => {
  if (dueAt === null) return 'var(--cmp-fg-dim, #9ca3af)';
  const days = daysUntil(dueAt);
  if (days < 0) return 'var(--cmp-fg-danger, #ef4444)';
  if (days <= 21) return 'var(--cmp-fg-warning, #eab308)';
  return 'var(--cmp-fg-success, #22c55e)';
};
