import { TbPlus, TbX } from 'react-icons/tb';
import type { QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FieldDef } from '../../../../components/FilterBuilder';
import {
  addChild,
  emptyGroup,
  emptyPredicate,
  getNode,
  isGroupNode,
  removeNode,
  setGroupKind,
  toggleNot,
  updateNode
} from './queryBuilderState';
import type { NodePath } from './queryBuilderState';
import { QueryLeaf } from './QueryLeaf';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type SharedProps = {
  root: QueryNode;
  onRootChange: (root: QueryNode) => void;
  fields: FieldDef[];
  leafCtx: LeafContext;
};

const NotToggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <button
    type="button"
    className={active ? styles.rowCtlOn : styles.rowCtl}
    title={active ? 'Negated — click to un-negate' : 'Negate this condition'}
    aria-pressed={active}
    onClick={onClick}
  >
    NOT
  </button>
);

/** One `and` / `or` group: an All/Any toggle (shown once there's more than one child), an optional
 *  NOT toggle, its children, and add-filter / add-group actions. The root group (`path === []`)
 *  renders without the surrounding card chrome and is never negatable. */
// How many nesting-accent colours to cycle through before repeating.
const NEST_LEVELS = 5;

export const QueryGroup = ({
  root,
  path,
  onRootChange,
  fields,
  leafCtx,
  depth = 0,
  negated = false,
  onToggleNegate,
  onRemove
}: SharedProps & {
  path: NodePath;
  depth?: number;
  negated?: boolean;
  onToggleNegate?: () => void;
  onRemove?: () => void;
}) => {
  const node = getNode(root, path);
  if (!node || !isGroupNode(node)) return null;

  const isRoot = path.length === 0;
  const childCount = node.children.length;
  // The root stays chrome-free while it's a plain flat list; a nested group always shows its
  // header so the user can see they created a group and can set its operator / negation.
  const showHeader = !isRoot;

  const body = (
    <>
      {(showHeader || childCount > 1) && (
        <div className={styles.groupHeader}>
          {!isRoot && onToggleNegate && <NotToggle active={negated} onClick={onToggleNegate} />}
          <div className={styles.matchToggle}>
            <button
              type="button"
              className={node.kind === 'and' ? styles.matchOn : styles.matchOff}
              onClick={() => onRootChange(setGroupKind(root, path, 'and'))}
            >
              All
            </button>
            <button
              type="button"
              className={node.kind === 'or' ? styles.matchOn : styles.matchOff}
              onClick={() => onRootChange(setGroupKind(root, path, 'or'))}
            >
              Any
            </button>
          </div>
          <span className={styles.matchHint}>
            {node.kind === 'and' ? 'of these must match' : 'of these may match'}
          </span>
          {!isRoot && onRemove && (
            <button
              type="button"
              className={styles.removeBtn}
              title="Remove group"
              onClick={onRemove}
            >
              <TbX size={11} />
            </button>
          )}
        </div>
      )}

      <div className={styles.children}>
        {childCount === 0 && <div className={styles.empty}>No conditions.</div>}
        {node.children.map((_child, index) => (
          <QueryNodeView
            key={index}
            root={root}
            slotPath={[...path, index]}
            onRootChange={onRootChange}
            fields={fields}
            leafCtx={leafCtx}
            depth={depth}
          />
        ))}
      </div>

      <div className={styles.groupFooter}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onRootChange(addChild(root, path, emptyPredicate()))}
        >
          <TbPlus size={11} /> Add condition
        </button>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() =>
            onRootChange(addChild(root, path, { ...emptyGroup('or'), children: [emptyPredicate()] }))
          }
        >
          <TbPlus size={11} /> Add group
        </button>
      </div>
    </>
  );

  return isRoot ? (
    <div className={styles.rootGroup}>{body}</div>
  ) : (
    <div className={styles.nestedGroup} data-nest={((depth - 1) % NEST_LEVELS) + 1}>
      {body}
    </div>
  );
};

/** Renders one child slot of a group. A `not` wrapper on the slot is surfaced as a single toggle
 *  on the row/group header (`negated`), never as a nested row - so NOT can only ever be on or off,
 *  not stacked. */
export const QueryNodeView = ({
  root,
  slotPath,
  onRootChange,
  fields,
  leafCtx,
  depth
}: SharedProps & { slotPath: NodePath; depth: number }) => {
  const slotNode = getNode(root, slotPath);
  if (!slotNode) return null;

  const negated = slotNode.kind === 'not';
  const contentPath = negated ? [...slotPath, 0] : slotPath;
  const content = getNode(root, contentPath);
  if (!content) return null;

  const toggleNegate = () => onRootChange(toggleNot(root, slotPath));
  const remove = () => onRootChange(removeNode(root, slotPath));

  // A `not` directly inside a `not` can't be produced by this UI (NOT is a toggle on the slot);
  // guard anyway so a hand-built / text-authored `not[not[…]]` degrades gracefully.
  if (content.kind === 'not') return null;

  if (isGroupNode(content)) {
    return (
      <QueryGroup
        root={root}
        path={contentPath}
        onRootChange={onRootChange}
        fields={fields}
        leafCtx={leafCtx}
        depth={depth + 1}
        negated={negated}
        onToggleNegate={toggleNegate}
        onRemove={remove}
      />
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowCtls}>
        <NotToggle active={negated} onClick={toggleNegate} />
      </div>
      <QueryLeaf
        node={content}
        fields={fields}
        leafCtx={leafCtx}
        onChange={next => onRootChange(updateNode(root, contentPath, () => next))}
        onRemove={remove}
      />
    </div>
  );
};
