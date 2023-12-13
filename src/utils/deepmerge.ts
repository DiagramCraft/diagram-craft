// based on https://gist.github.com/mir4ef/c172583bdb968951d9e57fb50d44c3f7

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = Record<string, any>;

const isObject = (item: any) => typeof item === 'object' && !Array.isArray(item);

export const deepMerge = <T extends Props>(target: Partial<T>, ...sources: Partial<T>[]): T => {
  const result: any = target;

  if (!isObject(result)) return target as T;

  for (const elm of sources) {
    if (!isObject(elm)) continue;

    for (const key of Object.keys(elm)) {
      if (isObject(elm[key])) {
        result[key] ??= {};
        deepMerge(result[key], elm[key] as any);
      } else {
        result[key] = elm[key];
      }
    }
  }

  return result;
};
