/** Cases due within `days` of `now`, *including* already-overdue ones (there is no lower bound). */
export const countDueWithin = (
  cases: readonly { dueAt?: string | null }[],
  days: number,
  now: Date = new Date(),
): number =>
  cases.filter(
    (governanceCase) =>
      governanceCase.dueAt != null &&
      (new Date(governanceCase.dueAt).getTime() - now.getTime()) / 86400000 <=
        days,
  ).length;

/** Replaces `{count}` and `{due}` in a subtext template. */
export const renderCaseCountSubtext = (
  template: string,
  count: number,
  due: number,
): string =>
  template
    .replaceAll("{count}", String(count))
    .replaceAll("{due}", String(due));
