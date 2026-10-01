export const CHANGE_CASE_STATUSES = ['open', 'completed', 'cancelled'] as const;
export type ChangeCaseStatus = (typeof CHANGE_CASE_STATUSES)[number];

export const isChangeCaseStatus = (value: unknown): value is ChangeCaseStatus =>
  CHANGE_CASE_STATUSES.includes(value as ChangeCaseStatus);

/** Row counts per case status, used for the status filter chips. */
export const countByStatus = (rows: readonly { case: { status: ChangeCaseStatus } }[]): Record<ChangeCaseStatus, number> => {
  const counts: Record<ChangeCaseStatus, number> = { open: 0, completed: 0, cancelled: 0 };
  for (const row of rows) counts[row.case.status] += 1;
  return counts;
};

/** Narrows rows by status and a free-text query over entity name, public id and requester. */
export const filterChangeCaseRows = <
  T extends {
    case: { status: ChangeCaseStatus };
    requesterName: string | null;
    entity: { _name: string; _publicId: string };
  }
>(
  rows: readonly T[],
  { status, query }: { status: ChangeCaseStatus | undefined; query: string }
): T[] => {
  const needle = query.trim().toLowerCase();
  return rows.filter(row => {
    if (status && row.case.status !== status) return false;
    if (!needle) return true;
    return `${row.entity._name} ${row.entity._publicId} ${row.requesterName ?? ''}`
      .toLowerCase()
      .includes(needle);
  });
};
