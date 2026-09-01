import { TbX } from 'react-icons/tb';
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
  asFieldPredicate,
  asRelationExists,
  leafPath,
  singleTerminalSchemaId,
  terminalSchemaScope,
  withLeafPath
} from './leafPath';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type LeafNode = Exclude<QueryNode, { kind: 'and' | 'or' | 'not' }>;

type QueryLeafProps = {
  node: LeafNode;
  /** Field defs for a flat (`path: []`) predicate on the root entity. */
  fields: FieldDef[];
  leafCtx: LeafContext;
  onChange: (node: QueryNode) => void;
  onRemove: () => void;
};

/**
 * One terminal condition. A flat `predicate` (`path: []`) is the reused `FilterRow` from
 * `FilterBuilder`, with an affordance to send it through a relation. A predicate with a traversal
 * `path`, or a `relationExists`, renders the shared `pathBuilder` hop editor plus a terminal
 * field / "just exists" choice (#2354, plan phase 5). Same-instance scoped filters (`[...]`) and
 * relation-context step kinds are still text-only (phases 6-7) and render as a read-only summary.
 */
export const QueryLeaf = ({ node, fields, leafCtx, onChange, onRemove }: QueryLeafProps) => {
  const { schemas, relationSchemas, enums, lifecycleStates, owners, joinedAssessment, atHopLimit } =
    leafCtx;
  const getFieldGroupAccess = leafCtx.getFieldGroupAccess;
  const rootSchemaScope = leafCtx.rootSchemaScope;

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

  // A traversal step this editor doesn't own yet (scoped `[...]` filter, or a relation-context
  // kind) - keep it read-only rather than dropping data the user can't see.
  const pathIsEditable = path.every(
    step =>
      (step.kind === 'forward' ||
        step.kind === 'backward' ||
        step.kind === 'typedRelation' ||
        step.kind === 'unboundTypedRelation') &&
      !step.filter
  );

  if (path.length > 0 && !pathIsEditable) {
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

  // Flat predicate: the row exactly as `FilterBuilder` renders it. A traversal condition is added
  // from the group footer ("Add related condition"), not per-row, to keep the row uncluttered.
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

  const terminalScope = terminalSchemaScope(path, {
    rootSchemaScope,
    schemas,
    relationSchemas,
    getFieldGroupAccess
  });
  const terminalFields = getEntityFilterFieldDefs({
    schemas,
    lifecycleStates,
    owners,
    enums,
    selectedSchemaId: singleTerminalSchemaId(terminalScope),
    joinedAssessment,
    getFieldGroupAccess
  });

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
                {depth === path.length - 1 && (
                  <button
                    type="button"
                    className={styles.hopRm}
                    title="Remove hop"
                    onClick={() => editPath(path.slice(0, -1))}
                  >
                    <TbX size={11} />
                  </button>
                )}
              </div>
            );
          }}
        />
        <button type="button" className={styles.removeBtn} title="Remove condition" onClick={onRemove}>
          <TbX size={11} />
        </button>
      </div>

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
