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
import {
  applyRelationLeafUpdate,
  emptyRelationPredicate,
  isFlatRelationLeaf,
  relationLeafCondition
} from './relationLeaf';
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

// Synthetic field picked from a condition row's field dropdown to turn that row into a root
// free-text clause (`{ kind: 'freeText' }`). Offered only where free text is grammatically valid
// (entity root tree, not scoped `[...]` filters, not relations) and not on the root `AND` when a
// top-bar search box already owns that clause.
const FREE_TEXT_FIELD: FieldDef = { id: '__free_text__', name: 'Free text', type: 'freetext' };

const defaultOpForField = (field: FieldDef | undefined): FilterCondition['op'] => {
  switch (field?.type) {
    case 'date':
      return 'on';
    case 'select':
    case 'number':
    case 'boolean':
      return 'equals';
    case 'rating':
      return 'gte';
    case 'presence':
      return 'not_empty';
    default:
      return 'contains';
  }
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

/** One `and` / `or` group. The header is a toolbar: an optional NOT toggle, the All/Any match
 *  toggle, `+ Condition` / `+ Relation` / `+ Group` actions, and (nested / scoped-filter panels) a
 *  remove `×`. The root group (`path === []`) renders without the surrounding card chrome and is
 *  never negatable. */
export const QueryGroup = ({
  root,
  path,
  onRootChange,
  fields,
  leafCtx,
  depth = 0,
  negated = false,
  onToggleNegate,
  onRemove,
  removeTitle = 'Remove group',
  forceHeader = false
}: SharedProps & {
  path: NodePath;
  depth?: number;
  negated?: boolean;
  onToggleNegate?: () => void;
  onRemove?: () => void;
  removeTitle?: string;
  /** Show the All/Any header even for the root group (used by the scoped-filter panel, where the
   *  match mode is always relevant). */
  forceHeader?: boolean;
}) => {
  const node = getNode(root, path);
  if (!node || !isGroupNode(node)) return null;

  const isRoot = path.length === 0;
  const childCount = node.children.length;
  const isRelation = leafCtx.rootKind === 'relation';
  const conditionSeed = isRelation ? emptyRelationPredicate(fields) : emptyPredicate();
  // Whether this group's condition rows offer "Free text" in the field dropdown. Entity root tree
  // only (not relations, not scoped `[...]` filters), and not on the root `AND` where a top-bar
  // search box already owns that clause (`QueryBuilder` strips exactly that node for the box). A
  // root `OR` or any nested group needs it - the `text:"x" OR <predicate>` case the box can't hold.
  const topBarOwnsText = leafCtx.showFreeText && isRoot && node.kind === 'and';
  const allowFreeTextField = !isRelation && !leafCtx.inScopedFilter && !topBarOwnsText;
  // Relation-rooted traversal (relationForward / relationBackward) isn't visually editable yet -
  // no "Add related condition" there.
  const relatedSeed = isRelation || leafCtx.atHopLimit ? null : firstHopPredicate(leafCtx);

  const body = (
    <>
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
        <div className={styles.headerAdds}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => onRootChange(addChild(root, path, conditionSeed))}
          >
            <TbPlus size={11} /> Condition
          </button>
          {relatedSeed && (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => onRootChange(addChild(root, path, relatedSeed))}
            >
              <TbPlus size={11} /> Relation
            </button>
          )}
          <button
            type="button"
            className={styles.addBtn}
            onClick={() =>
              onRootChange(addChild(root, path, { ...emptyGroup('or'), children: [conditionSeed] }))
            }
          >
            <TbPlus size={11} /> Group
          </button>
        </div>
        {onRemove && (!isRoot || forceHeader) && (
          <button
            type="button"
            className={styles.removeBtn}
            title={removeTitle}
            onClick={onRemove}
          >
            <TbX size={11} />
          </button>
        )}
      </div>

      <div className={styles.children}>
        {childCount === 0 && <div className={styles.empty}>No conditions.</div>}
        {node.children.map((_child, index) => (
          <QueryNodeView
            key={index}
            root={root}
            slotPath={[...path, index]}
            onRootChange={onRootChange}
            fields={fields}
            allowFreeTextField={allowFreeTextField}
            leafCtx={leafCtx}
            depth={depth}
          />
        ))}
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
  allowFreeTextField = false,
  leafCtx,
  depth
}: SharedProps & { slotPath: NodePath; depth: number; allowFreeTextField?: boolean }) => {
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

  const leafFields =
    allowFreeTextField || content.kind === 'freeText' ? [FREE_TEXT_FIELD, ...fields] : fields;

  return (
    <div className={styles.row}>
      <div className={styles.rowCtls}>
        <NotToggle active={negated} onClick={toggleNegate} />
      </div>
      <QueryLeaf
        node={content}
        fields={leafFields}
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
  onChange,
  onRemove
}: {
  filter: QueryNode | undefined;
  fields: FieldDef[];
  leafCtx: LeafContext;
  onChange: (filter: QueryNode | undefined) => void;
  onRemove: () => void;
}) => {
  const editableRoot: QueryNode =
    filter && isGroupNode(filter) ? filter : { kind: 'and', children: filter ? [filter] : [] };
  return (
    <QueryGroup
      root={editableRoot}
      path={[]}
      onRootChange={next =>
        onChange(isGroupNode(next) && next.children.length === 0 ? undefined : next)
      }
      fields={fields}
      leafCtx={{ ...leafCtx, inScopedFilter: true }}
      forceHeader
      onRemove={onRemove}
      removeTitle="Remove this where-filter"
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

  // A `freeText` node renders as a `FilterRow` whose field is the synthetic "Free text" entry -
  // one text input, no operator. Switching its field dropdown to a real field converts it back to
  // an ordinary predicate; switching a predicate's field to "Free text" converts the other way
  // (handled in the predicate branch below).
  if (node.kind === 'freeText') {
    const freeTextFields = fields.some(f => f.id === FREE_TEXT_FIELD.id)
      ? fields
      : [FREE_TEXT_FIELD, ...fields];
    return (
      <>
        <FilterRow
          condition={{ fieldId: FREE_TEXT_FIELD.id, op: 'contains', value: node.value }}
          fields={freeTextFields}
          onUpdate={updates => {
            if (updates.fieldId !== undefined && updates.fieldId !== FREE_TEXT_FIELD.id) {
              onChange({
                kind: 'predicate',
                path: [],
                fieldId: updates.fieldId,
                op: defaultOpForField(fields.find(f => f.id === updates.fieldId)),
                value: ''
              });
            } else if (updates.value !== undefined) {
              onChange({ kind: 'freeText', value: String(updates.value ?? '') });
            }
          }}
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

  // Relation-rooted: a flat FilterRow over the relation field list (own + In/Out endpoint) for the
  // two shapes the lean builder edits; anything deeper stays text-only.
  if (leafCtx.rootKind === 'relation') {
    if (node.kind === 'predicate' && isFlatRelationLeaf(node)) {
      return (
        <>
          <FilterRow
            condition={relationLeafCondition(node)}
            fields={fields}
            onUpdate={updates => onChange(applyRelationLeafUpdate(node, updates, fields))}
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
    return (
      <div className={styles.advancedLeaf}>
        <span className={styles.advancedLeafText}>
          {node.kind === 'relationExists' ? 'related record exists' : `traversal · ${node.fieldId}`}
        </span>
        <span className={styles.advancedLeafBadge}>text-only</span>
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
          onUpdate={updates =>
            updates.fieldId === FREE_TEXT_FIELD.id
              ? onChange({
                  kind: 'freeText',
                  value: typeof node.value === 'string' ? node.value : ''
                })
              : onChange({ ...node, ...updates })
          }
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

  const terminalScope = scopeAfterHop(path.length - 1);
  const terminalFields = fieldsForScope(terminalScope);

  return (
    <div className={styles.traversalLeaf}>
      {/* The hop chain is a vertical list, not a "a › b › c" row, so each hop's optional "where"
          filter can render directly beneath the hop it belongs to rather than in a detached stack
          - the wiring the user has to follow stays local even for a 3-hop path with two filters. */}
      <div className={styles.hopList}>
        <div className={styles.railSegment}>
          {path.map((step, depth) => {
            const stepContext = pathStepContext({
              rootSchemaScope,
              steps: path,
              depth,
              schemas,
              relationSchemas,
              getFieldGroupAccess
            });
            const scope = scopeAfterHop(depth);
            const scopeOpen = openScopes.has(depth) || ('filter' in step && !!step.filter);
            const isLast = depth === path.length - 1;
            return (
              <div key={depth} className={styles.hopBranch}>
                <div className={styles.hopRow}>
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
                  {isLast && (
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

                {scopeOpen && (
                  <div className={styles.scopedFilter}>
                    <ScopedFilterEditor
                      filter={'filter' in step ? step.filter : undefined}
                      fields={fieldsForScope(scope)}
                      leafCtx={{ ...leafCtx, rootSchemaScope: scope }}
                      onChange={filter => setStepFilter(depth, filter)}
                      onRemove={() => {
                        setStepFilter(depth, undefined);
                        closeScope(depth);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {!atHopLimit && nextHopContext.options.length > 0 && (
            <button type="button" className={styles.hopAdd} onClick={addHop}>
              <TbPlus size={11} /> hop
            </button>
          )}
        </div>

        <div className={styles.railSegment}>
          <div className={styles.hopRow}>
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
            <button
              type="button"
              className={styles.removeBtn}
              title="Remove condition"
              onClick={onRemove}
            >
              <TbX size={11} />
            </button>
          </div>
        </div>

        {node.kind === 'predicate' && (
          <div className={styles.railSegment}>
            <div className={styles.hopRow}>
              <div className={styles.terminalField}>
                <FilterRow
                  condition={{ fieldId: node.fieldId, op: node.op, value: node.value }}
                  fields={terminalFields}
                  onUpdate={updates => onChange({ ...node, ...updates })}
                  onRemove={onRemove}
                  hideRemove
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
