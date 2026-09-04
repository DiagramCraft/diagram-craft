import { TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import type { PathStep, ProjectionField } from '@arch-register/api-types/entityQueryIR';
import { getEntityFilterFieldDefs } from '../../../../components/FilterBuilder';
import type { FieldDef } from '../../../../components/FilterBuilder';
import { getRelationOwnFieldDefs } from '../../../relations/relationFilterFields';
import { HopPicker } from '../pathBuilder/HopPicker';
import { HopSequence } from '../pathBuilder/HopSequence';
import {
  pathStepOptions,
  positionStepContext,
  positionStepContextWithFallbackDirection,
  prunePositionedPathSteps,
  relationBackwardOptions,
  terminalPosition
} from '../pathBuilder/pathBuilderState';
import { singleTerminalSchemaId } from './leafPath';
import { isProjectionPathVisuallyEditable } from './queryBuilderState';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type Props = {
  projection: ProjectionField;
  onChange: (projection: ProjectionField) => void;
  onRemove: () => void;
  leafCtx: LeafContext;
  /** Steps `[0, lockedPrefixLength)` belong to the owning filter leaf and are not shown here - the
   *  row edits only the capture hops past it, the terminal field, the alias, and the toggles. `0`
   *  for a standalone column. */
  lockedPrefixLength?: number;
  /** Human label for aria (e.g. "column 2"). */
  label: string;
};

const lastStepKind = (path: PathStep[]): PathStep['kind'] | undefined =>
  path[path.length - 1]?.kind;

const relationSchemaIdOfLastStep = (path: PathStep[]): string | undefined => {
  const last = path[path.length - 1];
  return last && (last.kind === 'typedRelation' || last.kind === 'unboundTypedRelation')
    ? last.relationSchemaId
    : undefined;
};

/**
 * One projection column: a `HopSequence` of capture hops past the (optional) locked leaf prefix,
 * ending on a terminal scalar field, plus alias and - depending on the path shape - a "whole path"
 * (`includePath: true`) or "read off the relation link" (`source: 'relation'`) toggle. Reuses the
 * same position-aware `pathBuilder` traversal infra as the filter-leaf editor. A path the editor
 * can't represent renders read-only (#2354 phase 8; hop-attached #3162).
 */
export const ProjectionRow = ({
  projection,
  onChange,
  onRemove,
  leafCtx,
  lockedPrefixLength = 0,
  label
}: Props) => {
  const { schemas, relationSchemas, enums, lifecycleStates, owners, atHopLimit } = leafCtx;
  const { getFieldGroupAccess, rootKind, rootPosition } = leafCtx;
  const hopArgs = { rootPosition, schemas, relationSchemas, getFieldGroupAccess };

  const editable = isProjectionPathVisuallyEditable(
    projection.path,
    rootPosition.kind,
    projection.source
  );

  const removeButton = (
    <button type="button" className={styles.removeBtn} title="Remove column" onClick={onRemove}>
      <TbX size={11} />
    </button>
  );

  if (!editable) {
    return (
      <div className={styles.advancedLeaf}>
        <span className={styles.advancedLeafText}>{projection.alias ?? projection.fieldId}</span>
        <span className={styles.advancedLeafBadge}>text-only</span>
        {removeButton}
      </div>
    );
  }

  // `path` edits go through pruning so an underlying schema change can't leave a dangling step.
  const editPath = (nextPath: PathStep[]) => {
    const pruned = prunePositionedPathSteps(nextPath, hopArgs);
    // A `source: 'relation'` read only makes sense while the path ends at a typed relation.
    const stillRelationSource =
      projection.source === 'relation' &&
      (lastStepKind(pruned) === 'typedRelation' || lastStepKind(pruned) === 'unboundTypedRelation');
    onChange({
      ...projection,
      path: pruned,
      ...(projection.source === 'relation' && !stillRelationSource
        ? { source: undefined, fieldId: '_name' }
        : {})
    });
  };

  const relationSource = projection.source === 'relation';
  const terminal = terminalPosition(projection.path, hopArgs);
  const relationTerminalSchemaId = relationSchemaIdOfLastStep(projection.path);

  const terminalFields: FieldDef[] = relationSource
    ? getRelationOwnFieldDefs({
        relationSchemas,
        relationScope: relationTerminalSchemaId ? [relationTerminalSchemaId] : 'any',
        enums,
        getFieldGroupAccess
      })
    : terminal.kind === 'relation'
      ? getRelationOwnFieldDefs({
          relationSchemas,
          relationScope: terminal.relationScope,
          enums,
          getFieldGroupAccess
        })
      : getEntityFilterFieldDefs({
          schemas,
          lifecycleStates,
          owners,
          enums,
          selectedSchemaId: singleTerminalSchemaId(terminal.schemaScope),
          getFieldGroupAccess
        });

  const nextHop = positionStepContextWithFallbackDirection({
    ...hopArgs,
    steps: projection.path,
    depth: projection.path.length
  });

  const visibleSteps = projection.path.slice(lockedPrefixLength);
  const canRemoveHop = projection.path.length > lockedPrefixLength;
  const showIncludePathToggle = rootKind === 'entity' && !relationSource;
  const canReadRelationRow =
    lastStepKind(projection.path) === 'typedRelation' ||
    lastStepKind(projection.path) === 'unboundTypedRelation';

  return (
    <div className={styles.projectionRow}>
      <div className={styles.traversalHead}>
        <HopSequence
          items={visibleSteps}
          getItemKey={(_step, index) => index + lockedPrefixLength}
          onAdd={() => {
            if (nextHop.options[0]) editPath([...projection.path, nextHop.options[0].step]);
          }}
          addLabel="hop"
          addDisabled={atHopLimit || nextHop.options.length === 0 || relationSource}
          renderItem={(step, index) => {
            const depth = index + lockedPrefixLength;
            const stepContext = positionStepContext({ ...hopArgs, steps: projection.path, depth });
            return (
              <div className={styles.hop}>
                <HopPicker
                  step={step}
                  stepContext={stepContext}
                  ariaLabelDirection={`Direction for ${label} hop ${depth + 1}`}
                  ariaLabelHop={`Relation for ${label} hop ${depth + 1}`}
                  hideDirectionToggle={!stepContext.hasDirectionToggle}
                  onChangeStep={nextStep =>
                    editPath(projection.path.map((s, i) => (i === depth ? nextStep : s)))
                  }
                  onToggleDirection={direction => {
                    const ctx = positionStepContext({ ...hopArgs, steps: projection.path, depth });
                    if (ctx.currentPosition.kind !== 'entity') return;
                    const options =
                      direction === ctx.direction
                        ? ctx.options
                        : [
                            ...pathStepOptions({
                              direction,
                              currentSchemaScope: ctx.currentPosition.schemaScope,
                              schemas,
                              relationSchemas,
                              getFieldGroupAccess
                            }),
                            ...(direction === 'out'
                              ? relationBackwardOptions({
                                  schemaScope: ctx.currentPosition.schemaScope,
                                  schemas,
                                  relationSchemas,
                                  getFieldGroupAccess
                                })
                              : [])
                          ];
                    if (options[0]) {
                      editPath(projection.path.map((s, i) => (i === depth ? options[0]!.step : s)));
                    }
                  }}
                />
                {depth === projection.path.length - 1 && canRemoveHop && (
                  <button
                    type="button"
                    className={styles.hopRm}
                    title="Remove hop"
                    onClick={() => editPath(projection.path.slice(0, -1))}
                  >
                    <TbX size={11} />
                  </button>
                )}
              </div>
            );
          }}
        />
        {removeButton}
      </div>

      <div className={styles.projectionTerminal}>
        {showIncludePathToggle && (
          <label className={styles.projectionToggle}>
            <input
              type="checkbox"
              checked={projection.includePath === true}
              onChange={event =>
                onChange({
                  ...projection,
                  includePath: event.target.checked ? true : undefined,
                  fieldId: event.target.checked ? '_id' : '_name'
                })
              }
            />
            whole path
          </label>
        )}

        {canReadRelationRow && projection.includePath !== true && (
          <label className={styles.projectionToggle}>
            <input
              type="checkbox"
              checked={relationSource}
              onChange={event =>
                onChange({
                  ...projection,
                  source: event.target.checked ? 'relation' : undefined,
                  fieldId: '_name'
                })
              }
            />
            off the relation link
          </label>
        )}

        {projection.includePath !== true && (
          <div className={styles.projectionField}>
            <Select.Root
              value={projection.fieldId}
              onChange={value => onChange({ ...projection, fieldId: value ?? projection.fieldId })}
            >
              {terminalFields.map(field => (
                <Select.Item key={field.id} value={field.id}>
                  {field.name}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        )}

        <input
          className={styles.projectionAlias}
          type="text"
          placeholder="column name (optional)"
          value={projection.alias ?? ''}
          onChange={event =>
            onChange({ ...projection, alias: event.target.value ? event.target.value : undefined })
          }
        />
      </div>
    </div>
  );
};
