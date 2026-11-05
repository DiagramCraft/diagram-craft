import type { ReactNode } from 'react';
import { ListEditor, type ListEditorItemContext } from './ListEditor';

type Props<T, G extends { id: string }> = {
  items: T[];
  groups: G[];
  /** Group id of an item. Missing ids, and ids that are not in `groups`, land in the ungrouped bucket. */
  getGroupId: (item: T) => string | undefined;
  getId: (item: T) => string;
  /** Header of a group section. The caller draws the whole header, including any add control and menu. */
  renderGroupHeader: (group: G) => ReactNode;
  /** Shown instead of the list when a group has no items. The ungrouped bucket renders nothing when empty. */
  renderEmpty?: (group: G) => ReactNode;
  /**
   * Called with the items of the affected bucket (in display order) and bucket-local indices.
   * Items cannot be dragged between buckets.
   */
  onMove: (bucketItems: T[], fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, ctx: ListEditorItemContext<T>) => ReactNode;
  disabled?: boolean;
  className?: string;
  /** Class on each group section (header and list) */
  groupClassName?: string;
};

const noop = () => undefined;

/**
 * An ungrouped list followed by one section per group, each with its own header, empty state and drag scope.
 * Built on `ListEditor` (operations mode, bare layout), one instance per bucket.
 */
export const GroupedListEditor = <T, G extends { id: string }>(props: Props<T, G>) => {
  const { items, groups, getGroupId, disabled } = props;

  const groupIds = new Set(groups.map(g => g.id));
  const ungrouped: T[] = [];
  const byGroup = new Map<string, T[]>(groups.map(g => [g.id, []]));
  for (const item of items) {
    const gid = getGroupId(item);
    if (gid !== undefined && groupIds.has(gid)) byGroup.get(gid)?.push(item);
    else ungrouped.push(item);
  }

  const list = (bucket: T[]) => (
    <ListEditor<T>
      items={bucket}
      getId={props.getId}
      layout="bare"
      header="none"
      reorder="drag"
      disabled={disabled}
      addLabel=""
      // the add control lives in the group header
      addControl={false}
      onAdd={noop}
      onMove={(from, to) => props.onMove(bucket, from, to)}
      renderItem={props.renderItem}
    />
  );

  return (
    <div className={props.className}>
      {ungrouped.length > 0 && list(ungrouped)}
      {groups.map(group => {
        const bucket = byGroup.get(group.id) ?? [];
        return (
          <div className={props.groupClassName} key={group.id}>
            {props.renderGroupHeader(group)}
            {bucket.length > 0 ? list(bucket) : props.renderEmpty?.(group)}
          </div>
        );
      })}
    </div>
  );
};
