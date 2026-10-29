export const CHANGE_CASE_STATUSES = ['open', 'completed', 'cancelled'] as const;
export type ChangeCaseStatus = (typeof CHANGE_CASE_STATUSES)[number];

export const isChangeCaseStatus = (value: unknown): value is ChangeCaseStatus =>
  CHANGE_CASE_STATUSES.includes(value as ChangeCaseStatus);

/** Narrows rows to one case status; `undefined` keeps every row. */
export const filterByStatus = <T extends { case: { status: ChangeCaseStatus } }>(
  rows: readonly T[],
  status: ChangeCaseStatus | undefined
): T[] => (status ? rows.filter(row => row.case.status === status) : [...rows]);
