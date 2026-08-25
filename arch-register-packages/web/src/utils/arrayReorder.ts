export const moveWithinBucket = <T extends { id: string }>(
  all: T[],
  bucketIds: readonly string[],
  from: number,
  to: number
): T[] => {
  if (from === to || from < 0 || to < 0 || from >= bucketIds.length || to >= bucketIds.length) {
    return all;
  }

  const reorderedBucketIds = [...bucketIds];
  const [movedId] = reorderedBucketIds.splice(from, 1);
  reorderedBucketIds.splice(to, 0, movedId!);

  const byId = new Map(all.map(item => [item.id, item]));
  const reorderedBucketItems = reorderedBucketIds.map(id => byId.get(id)).filter(item => !!item);
  let bucketCursor = 0;
  return all.map(item =>
    bucketIds.includes(item.id) ? reorderedBucketItems[bucketCursor++]! : item
  );
};

export const moveInArray = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
};
