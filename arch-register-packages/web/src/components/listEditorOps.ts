export const updateAt = <T>(items: T[], index: number, patch: Partial<T>): T[] =>
  items.map((item, i) => (i === index ? { ...item, ...patch } : item));

export const replaceAt = <T>(items: T[], index: number, next: T): T[] =>
  items.map((item, i) => (i === index ? next : item));

export const removeAt = <T>(items: T[], index: number): T[] => items.filter((_, i) => i !== index);

export const moveItem = <T>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved as T);
  return next;
};

/**
 * Keeps a list of stable row keys aligned with a list whose items have no usable id.
 * Truncates when the list shrank and appends fresh keys when it grew.
 */
export const reconcileKeys = (keys: string[], length: number, makeKey: () => string): string[] => {
  if (keys.length === length) return keys;
  if (keys.length > length) return keys.slice(0, length);
  return [...keys, ...Array.from({ length: length - keys.length }, makeKey)];
};
