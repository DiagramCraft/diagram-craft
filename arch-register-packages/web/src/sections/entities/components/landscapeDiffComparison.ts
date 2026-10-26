/**
 * Three-way classification for comparing two projects' end states against the live state.
 *
 * `from` is the first ("this") project's value, `to` the other project's, and `current` the live
 * value both started from. A field only appears in a scenario diff when the two projects disagree,
 * so at most one of them can still equal the live value.
 */
export type ChangeOwner = 'this' | 'other' | 'conflict';
export type RowOwner = ChangeOwner | 'both';

export const classifyFieldChange = (change: {
  current: string;
  from: string;
  to: string;
}): ChangeOwner => {
  if (change.from === change.current) return 'other';
  if (change.to === change.current) return 'this';
  return 'conflict';
};

/** Summarises the owners of an entity's or relation's changed fields; null when nothing is known. */
export const classifyRow = (owners: ChangeOwner[]): RowOwner | null => {
  if (owners.length === 0) return null;
  if (owners.includes('conflict')) return 'conflict';
  const hasThis = owners.includes('this');
  const hasOther = owners.includes('other');
  if (hasThis && hasOther) return 'both';
  return hasThis ? 'this' : 'other';
};

export const ROW_OWNER_PRIORITY: Record<RowOwner, number> = {
  conflict: 0,
  both: 1,
  this: 2,
  other: 3
};
