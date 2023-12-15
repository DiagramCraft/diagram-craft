export const smallest = <T>(arr: T[], comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) < 0 ? acc : cur), arr[0]);
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const smallestIndex = (a: Array<any>) => {
  let lowest = 0;
  for (let i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
  }
  return lowest;
};

export const largest = <T>(arr: T[], comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) > 0 ? acc : cur), arr[0]);
};

export const unique = <T>(arr: T[], respectTo: (e: T) => unknown = a => a): T[] => {
  const seen = new Set();
  const result: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    const key = respectTo(e);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result;
};

export const reversed = <T>(l: T[]): T[] => [...l].reverse();
