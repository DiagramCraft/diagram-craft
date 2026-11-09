export const toFieldId = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const uniqueFieldId = (baseId: string, existingIds: Iterable<string>): string => {
  const taken = new Set(existingIds);
  let id = baseId;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${baseId}_${suffix}`;
    suffix += 1;
  }
  return id;
};
