export const deepClone = <T>(target: T): T => {
  if (target === null) {
    return target;
  }

  if (target instanceof Date) {
    return new Date(target.getTime()) as T;
  }

  // T extends unknown[] specifies that T should be an array and would return T type
  if (Array.isArray(target)) {
    return (target as T extends unknown[] ? T : never).map(item => deepClone(item)) as T;
  }

  if (typeof target === 'object') {
    const cp = { ...(target as Record<string, unknown>) };
    Object.keys(cp).forEach(key => {
      cp[key] = deepClone(cp[key]);
    });
    return cp as T;
  }

  return target;
};
