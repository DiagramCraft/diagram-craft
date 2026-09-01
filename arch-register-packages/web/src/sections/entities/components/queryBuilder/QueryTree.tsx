import { useState } from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import type { PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import {
  FilterRow,
  getEntityFilterFieldDefs,
  type FieldDef
} from '../../../../components/FilterBuilder';
import { HopPicker } from '../pathBuilder/HopPicker';
import { HopSequence } from '../pathBuilder/HopSequence';
import {
  pathStepContext,
  pathStepContextWithFallbackDirection,
  pathStepOptions,
  pruneInvalidPathSteps
} from '../pathBuilder/pathBuilderState';
import {
  addChild,
  emptyGroup,
  emptyPredicate,
  getNode,
  isGroupNode,
  isPathVisuallyEditable,
  removeNode,
  setGroupKind,
  toggleNot,
  updateNode
} from './queryBuilderState';
import type { NodePath } from './queryBuilderState';
import {
  asFieldPredicate,
  asRelationExists,
  firstHopPredicate,
  leafPath,
  singleTerminalSchemaId,
  terminalSchemaScope,
  withLeafPath
} from './leafPath';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

// Everything for the boolean-tree UI lives in this one file: `QueryGroup`, `QueryNodeView`,
// `QueryLeaf`, and `ScopedFilterEditor` are mutually recursive (a group contains node slots, a
// slot renders a leaf, a leaf's hop can carry a `[...]` scoped filter which is itself a group), so
// splitting them would just reintroduce an import cycle.

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

// How many nesting-accent colours to cycle through before repeating.
const NEST_LEVELS = 5;

/** One `and` / `or` group: an All/Any toggle (shown once there's more than one child), an optional
 *  NOT toggle, its children, and add-condition / add-related / add-group actions. The root group
 *  (`path === []`) renders without the surrounding card chrome and is never negatable. */
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
  const relatedSeed = leafCtx.atHopLimit ? null : firstHopPredicate(leafCtx);
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
        {relatedSeed && (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onRootChange(addChild(root, path, relatedSeed))}
          >
            <TbPlus size={11} /> Add related condition
          </button>
        )}
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

type LeafNode = Exclude<QueryNode, { kind: 'and' | 'or' | 'not' }>;

/** The nested boolean tree for one hop's same-instance `[...]` scoped filter. Wraps a bare
 *  predicate in an `and` so `QueryGroup` always has a group to edit; emits `undefined` when the
 *  user empties it so the `filter` key is dropped from the step. */
const ScopedFilterEditor = ({
  filter,
  fields,
  leafCtx,
  onChange
}: {
  filter: QueryNode | undefined;
  fields: FieldDef[];
  leafCtx: LeafContext;
  onChange: (filter: QueryNode | undefined) => void;
}) => {
  const editableRoot: QueryNode =
    filter && isGroupNode(filter)
      ? filter
      : { kind: 'and', children: filter ? [filter] : [] };
  return (
    <QueryGroup
      root={editableRoot}
      path={[]}
      onRootChange={next =>
        onChange(isGroupNode(next) && next.children.length === 0 ? undefined : next)
      }
      fields={fields}
      leafCtx={leafCtx}
    />
  );
};

const stripStepFilter = (step: PathStep): PathStep => {
  if ('filter' in step && step.filter) {
    const copy = { ...step };
    delete (copy as { filter?: unknown }).filter;
    return copy;
  }
  return step;
};

/**
 * One terminal condition. A flat `predicate` (`path: []`) is the reused `FilterRow`. A predicate
 * with a traversal `path`, or a `relationExists`, renders the shared `pathBuilder` hop editor,
 * an optional per-hop "where…" scoped filter (`PathStep.filter`, the `[...]` grammar), and a
 * terminal field / "just exists" choice (#2354, plan phases 5-6). Relation-context step kinds
 * are still text-only (phase 7) and render as a read-only summary.
 */
export const QueryLeaf = ({
  node,
  fields,
  leafCtx,
  onChange,
  onRemove
}: {
  node: LeafNode;
  fields: FieldDef[];
  leafCtx: LeafContext;
  onChange: (node: QueryNode) => void;
  onRemove: () => void;
}) => {
  const { schemas, relationSchemas, enums, lifecycleStates, owners, joinedAssessment, atHopLimit } =
    leafCtx;
  const getFieldGroupAccess = leafCtx.getFieldGroupAccess;
  const rootSchemaScope = leafCtx.rootSchemaScope;

  // Hops whose scoped-filter panel is open even though the filter is still empty.
  const [openScopes, setOpenScopes] = useState<ReadonlySet<number>>(() => new Set());

  if (node.kind === 'freeText') {
    return (
      <div className={styles.advancedLeaf}>
        <span className={styles.advancedLeafText}>{`text contains "${node.value}"`}</span>
        <button type="button" className={styles.removeBtn} title="Remove" onClick={onRemove}>
          <TbX size={11} />
        </button>
      </div>
    );
  }

  const path = leafPath(node);

  // A relation-context step kind this editor doesn't own yet - keep it read-only rather than
  // dropping data the user can't see. (Scoped `[...]` filters are editable now.)
  if (path.length > 0 && !isPathVisuallyEditable(path)) {
    return (
      <div className={styles.advancedLeaf}>
        <span className={styles.advancedLeafText}>
          {node.kind === 'relationExists' ? 'related record exists' : `related · ${node.fieldId}`}
        </span>
        <span className={styles.advancedLeafBadge}>text-only</span>
        <button type="button" className={styles.removeBtn} title="Remove" onClick={onRemove}>
          <TbX size={11} />
        </button>
      </div>
    );
  }

  const editPath = (nextPath: PathStep[]) => {
    const pruned = pruneInvalidPathSteps(nextPath, {
      rootSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    onChange(withLeafPath(node, pruned));
  };

  const changeStep = (depth: number, next: PathStep) =>
    editPath(path.map((step, index) => (index === depth ? next : step)));

  const setStepFilter = (depth: number, filter: QueryNode | undefined) => {
    const step = path[depth];
    if (!step) return;
    changeStep(
      depth,
      filter && !(isGroupNode(filter) && filter.children.length === 0)
        ? ({ ...step, filter } as PathStep)
        : stripStepFilter(step)
    );
  };

  const closeScope = (depth: number) =>
    setOpenScopes(prev => {
      const next = new Set(prev);
      next.delete(depth);
      return next;
    });

  const toggleScope = (depth: number) => {
    const step = path[depth];
    const hasFilter = !!step && 'filter' in step && !!step.filter;
    if (hasFilter) {
      setStepFilter(depth, undefined);
      closeScope(depth);
      return;
    }
    setOpenScopes(prev => {
      const next = new Set(prev);
      if (next.has(depth)) next.delete(depth);
      else next.add(depth);
      return next;
    });
  };

  const toggleStepDirection = (depth: number, direction: 'in' | 'out') => {
    const ctx = pathStepContext({
      rootSchemaScope,
      steps: path,
      depth,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    const options =
      direction === ctx.direction
        ? ctx.options
        : pathStepOptions({
            direction,
            currentSchemaScope: ctx.currentSchemaScope,
            schemas,
            relationSchemas,
            getFieldGroupAccess
          });
    if (options[0]) changeStep(depth, options[0].step);
  };

  const nextHopContext = pathStepContextWithFallbackDirection({
    rootSchemaScope,
    steps: path,
    depth: path.length,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  });
  const addHop = () => {
    if (nextHopContext.options[0]) editPath([...path, nextHopContext.options[0].step]);
  };

  // Flat predicate: the row exactly as `FilterBuilder` renders it, minus its own remove X (the
  // builder owns a single remove control per row). A traversal condition is added from the group
  // footer ("Add related condition"), not per-row, to keep the row uncluttered.
  if (node.kind === 'predicate' && path.length === 0) {
    const condition: FilterCondition = { fieldId: node.fieldId, op: node.op, value: node.value };
    return (
      <>
        <FilterRow
          condition={condition}
          fields={fields}
          onUpdate={updates => onChange({ ...node, ...updates })}
          onRemove={onRemove}
          hideRemove
        />
        <button
          type="button"
          className={styles.removeBtn}
          title="Remove condition"
          onClick={onRemove}
        >
          <TbX size={11} />
        </button>
      </>
    );
  }

  const scopeAfterHop = (depth: number) =>
    terminalSchemaScope(path.slice(0, depth + 1), {
      rootSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });

  const fieldsForScope = (scope: ReturnType<typeof scopeAfterHop>) =>
    getEntityFilterFieldDefs({
      schemas,
      lifecycleStates,
      owners,
      enums,
      selectedSchemaId: singleTerminalSchemaId(scope),
      joinedAssessment,
      getFieldGroupAccess
    });

  const scopeName = (scope: ReturnType<typeof scopeAfterHop>) => {
    const id = singleTerminalSchemaId(scope);
    return (id && schemas.find(schema => schema.id === id)?.name) || 'related record';
  };

  const terminalScope = scopeAfterHop(path.length - 1);
  const terminalFields = fieldsForScope(terminalScope);

  return (
    <div className={styles.traversalLeaf}>
      <div className={styles.traversalHead}>
        <HopSequence
          items={path}
          getItemKey={(_step, depth) => depth}
          onAdd={addHop}
          addLabel="hop"
          addDisabled={atHopLimit || nextHopContext.options.length === 0}
          renderItem={(step, depth) => {
            const stepContext = pathStepContext({
              rootSchemaScope,
              steps: path,
              depth,
              schemas,
              relationSchemas,
              getFieldGroupAccess
            });
            const scopeOpen = openScopes.has(depth) || ('filter' in step && !!step.filter);
            return (
              <div className={styles.hop}>
                <HopPicker
                  step={step}
                  stepContext={stepContext}
                  ariaLabelDirection={`Direction for hop ${depth + 1}`}
                  ariaLabelHop={`Relation for hop ${depth + 1}`}
                  onChangeStep={next => changeStep(depth, next)}
                  onToggleDirection={direction => toggleStepDirection(depth, direction)}
                />
                <button
                  type="button"
                  className={scopeOpen ? styles.rowCtlOn : styles.rowCtl}
                  title="Filter the record this hop lands on"
                  aria-pressed={scopeOpen}
                  onClick={() => toggleScope(depth)}
                >
                  where
                </button>
                {depth === path.length - 1 && (
                  <button
                    type="button"
                    className={styles.hopRm}
                    title="Remove hop"
                    onClick={() => {
                      closeScope(depth);
                      editPath(path.slice(0, -1));
                    }}
                  >
                    <TbX size={11} />
                  </button>
                )}
              </div>
            );
          }}
        />
        <button
          type="button"
          className={styles.removeBtn}
          title="Remove condition"
          onClick={onRemove}
        >
          <TbX size={11} />
        </button>
      </div>

      {path.map((step, depth) => {
        const open = openScopes.has(depth) || ('filter' in step && !!step.filter);
        if (!open) return null;
        const scope = scopeAfterHop(depth);
        return (
          <div key={depth} className={styles.scopedFilter}>
            <div className={styles.scopedFilterHead}>
              <span>where the {scopeName(scope)} at hop {depth + 1} matches</span>
              <button
                type="button"
                className={styles.hopRm}
                title="Remove this where-filter"
                onClick={() => {
                  setStepFilter(depth, undefined);
                  closeScope(depth);
                }}
              >
                <TbX size={11} />
              </button>
            </div>
            <ScopedFilterEditor
              filter={'filter' in step ? step.filter : undefined}
              fields={fieldsForScope(scope)}
              leafCtx={{ ...leafCtx, rootSchemaScope: scope }}
              onChange={filter => setStepFilter(depth, filter)}
            />
          </div>
        );
      })}

      <div className={styles.traversalTerminal}>
        <div className={styles.matchToggle}>
          <button
            type="button"
            className={node.kind === 'predicate' ? styles.matchOn : styles.matchOff}
            onClick={() => onChange(asFieldPredicate(node))}
          >
            has a field
          </button>
          <button
            type="button"
            className={node.kind === 'relationExists' ? styles.matchOn : styles.matchOff}
            onClick={() => onChange(asRelationExists(node))}
          >
            just exists
          </button>
        </div>

        {node.kind === 'predicate' ? (
          <FilterRow
            condition={{ fieldId: node.fieldId, op: node.op, value: node.value }}
            fields={terminalFields}
            onUpdate={updates => onChange({ ...node, ...updates })}
            onRemove={onRemove}
            hideRemove
          />
        ) : (
          <span className={styles.matchHint}>the related record only has to exist</span>
        )}
      </div>
    </div>
  );
};
