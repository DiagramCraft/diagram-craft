export const smallest = <T>(arr: T[], comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) < 0 ? acc : cur), arr[0]);
};

export const largest = <T>(arr: T[], comparator: (a: T, b: T) => number): T => {
  return arr.slice(1).reduce((acc, cur) => (comparator(acc, cur) > 0 ? acc : cur), arr[0]);
};
