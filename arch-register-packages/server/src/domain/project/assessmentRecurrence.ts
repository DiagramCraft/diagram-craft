import type { AssessmentRecurrence } from '@arch-register/api-types/assessmentContract';

const DAY_MS = 24 * 60 * 60 * 1000;

export const validateAssessmentRecurrence = (recurrence: AssessmentRecurrence) => {
  switch (recurrence.type) {
    case 'none':
      return;
    case 'weekly':
      if (!Number.isInteger(recurrence.intervalWeeks) || recurrence.intervalWeeks < 1) {
        throw new Error('Weekly recurrence intervalWeeks must be a positive integer');
      }
      return;
    case 'monthly':
      if (!Number.isInteger(recurrence.intervalMonths) || recurrence.intervalMonths < 1) {
        throw new Error('Monthly recurrence intervalMonths must be a positive integer');
      }
      return;
  }
};

export const computeNextOccurrenceAt = (recurrence: AssessmentRecurrence, from: Date): Date => {
  validateAssessmentRecurrence(recurrence);
  switch (recurrence.type) {
    case 'none':
      throw new Error('Cannot compute the next occurrence for a non-recurring assessment');
    case 'weekly':
      return new Date(from.getTime() + recurrence.intervalWeeks * 7 * DAY_MS);
    case 'monthly': {
      const next = new Date(from);
      next.setUTCMonth(next.getUTCMonth() + recurrence.intervalMonths);
      return next;
    }
  }
};
