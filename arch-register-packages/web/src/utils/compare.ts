export const compareStrings = (
  a: string | null | undefined,
  b: string | null | undefined
): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
};

export const compareNumbers = (
  a: number | null | undefined,
  b: number | null | undefined
): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
};

export const compareDates = (
  a: string | Date | null | undefined,
  b: string | Date | null | undefined
): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const aTime = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const bTime = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return aTime - bTime;
};

export const compareBy =
  <T, V>(select: (row: T) => V, cmp: (a: V, b: V) => number) =>
  (a: T, b: T): number =>
    cmp(select(a), select(b));
