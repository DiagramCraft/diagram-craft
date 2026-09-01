import { TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import type { PathStep, ProjectionField } from '@arch-register/api-types/entityQueryIR';
import { getEntityFilterFieldDefs } from '../../../../components/FilterBuilder';
import { HopPicker } from '../pathBuilder/HopPicker';
import { HopSequence } from '../pathBuilder/HopSequence';
import {
  pathStepContext,
  pathStepContextWithFallbackDirection,
  pathStepOptions,
  pruneInvalidPathSteps
} from '../pathBuilder/pathBuilderState';
import { singleTerminalSchemaId, terminalSchemaScope } from './leafPath';
import { isPathVisuallyEditable } from './queryBuilderState';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type Props = {
  projections: ProjectionField[];
  onChange: (projections: ProjectionField[]) => void;
  leafCtx: LeafContext;
};

/**
 * The builder's "Columns" section (#2354, plan phase 8). Each projection is a `HopSequence` of
 * `HopPicker`s (reusing the leaf's traversal infra) ending on a terminal scalar field, plus an
 * optional alias and a "whole chain" toggle (`chain: true`). Same `MAX_PATH_HOPS` budget as
 * everything else - `countHops` already accounts for projection paths. A projection the editor
 * can't represent (a `source: 'relation'` read, or a relation-context step) renders read-only.
 */
export const ProjectionEditor = ({ projections, onChange, leafCtx }: Props) => {
  const { schemas, relationSchemas, enums, lifecycleStates, owners, atHopLimit } = leafCtx;
  const { getFieldGroupAccess, rootSchemaScope } = leafCtx;

  const hopArgs = { rootSchemaScope, schemas, relationSchemas, getFieldGroupAccess };

  const update = (index: number, next: ProjectionField) =>
    onChange(projections.map((projection, i) => (i === index ? next : projection)));

  const editPath = (index: number, path: PathStep[]) => {
    const pruned = pruneInvalidPathSteps(path, hopArgs);
    update(index, { ...projections[index]!, path: pruned });
  };

  const addProjection = () => {
    const context = pathStepContextWithFallbackDirection({ ...hopArgs, steps: [], depth: 0 });
    if (!context.options[0]) return;
    onChange([...projections, { path: [context.options[0].step], fieldId: '_name' }]);
  };

  return (
    <div className={styles.columns}>
      <div className={styles.columnsHeader}>
        <span className={styles.previewLabel}>Columns</span>
        <span className={styles.matchHint}>traversed values, selectable as table columns under Manage fields</span>
      </div>

      {projections.map((projection, index) => {
        if (projection.source === 'relation' || !isPathVisuallyEditable(projection.path)) {
          return (
            <div key={index} className={styles.advancedLeaf}>
              <span className={styles.advancedLeafText}>
                {projection.alias ?? projection.fieldId}
              </span>
              <span className={styles.advancedLeafBadge}>text-only</span>
              <button
                type="button"
                className={styles.removeBtn}
                title="Remove column"
                onClick={() => onChange(projections.filter((_, i) => i !== index))}
              >
                <TbX size={11} />
              </button>
            </div>
          );
        }

        const scope = terminalSchemaScope(projection.path, hopArgs);
        const terminalFields = getEntityFilterFieldDefs({
          schemas,
          lifecycleStates,
          owners,
          enums,
          selectedSchemaId: singleTerminalSchemaId(scope),
          getFieldGroupAccess
        });
        const nextHop = pathStepContextWithFallbackDirection({
          ...hopArgs,
          steps: projection.path,
          depth: projection.path.length
        });

        return (
          <div key={index} className={styles.projectionRow}>
            <div className={styles.traversalHead}>
              <HopSequence
                items={projection.path}
                getItemKey={(_step, depth) => depth}
                onAdd={() => {
                  if (nextHop.options[0]) {
                    editPath(index, [...projection.path, nextHop.options[0].step]);
                  }
                }}
                addLabel="hop"
                addDisabled={atHopLimit || nextHop.options.length === 0}
                renderItem={(step, depth) => {
                  const stepContext = pathStepContext({
                    ...hopArgs,
                    steps: projection.path,
                    depth
                  });
                  return (
                    <div className={styles.hop}>
                      <HopPicker
                        step={step}
                        stepContext={stepContext}
                        ariaLabelDirection={`Direction for column ${index + 1} hop ${depth + 1}`}
                        ariaLabelHop={`Relation for column ${index + 1} hop ${depth + 1}`}
                        onChangeStep={nextStep =>
                          editPath(
                            index,
                            projection.path.map((s, i) => (i === depth ? nextStep : s))
                          )
                        }
                        onToggleDirection={direction => {
                          const ctx = pathStepContext({ ...hopArgs, steps: projection.path, depth });
                          const options =
                            direction === ctx.direction
                              ? ctx.options
                              : pathStepOptions({
                                  ...hopArgs,
                                  direction,
                                  currentSchemaScope: ctx.currentSchemaScope
                                });
                          if (options[0]) {
                            editPath(
                              index,
                              projection.path.map((s, i) => (i === depth ? options[0]!.step : s))
                            );
                          }
                        }}
                      />
                      {depth === projection.path.length - 1 && (
                        <button
                          type="button"
                          className={styles.hopRm}
                          title="Remove hop"
                          onClick={() => editPath(index, projection.path.slice(0, -1))}
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
                title="Remove column"
                onClick={() => onChange(projections.filter((_, i) => i !== index))}
              >
                <TbX size={11} />
              </button>
            </div>

            <div className={styles.traversalTerminal}>
              <label className={styles.projectionChain}>
                <input
                  type="checkbox"
                  checked={projection.chain === true}
                  onChange={event =>
                    update(index, {
                      ...projection,
                      chain: event.target.checked ? true : undefined,
                      fieldId: event.target.checked ? '_id' : '_name'
                    })
                  }
                />
                whole chain
              </label>

              {projection.chain !== true && (
                <div className={styles.projectionField}>
                  <Select.Root
                    value={projection.fieldId}
                    onChange={value =>
                      update(index, { ...projection, fieldId: value ?? projection.fieldId })
                    }
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
                  update(index, {
                    ...projection,
                    alias: event.target.value ? event.target.value : undefined
                  })
                }
              />
            </div>
          </div>
        );
      })}

      <button type="button" className={styles.addBtn} onClick={addProjection}>
        <TbPlus size={11} /> Add column
      </button>
    </div>
  );
};
