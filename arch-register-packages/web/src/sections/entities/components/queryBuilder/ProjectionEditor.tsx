import { TbPlus } from 'react-icons/tb';
import type { ProjectionField, QueryNode } from '@arch-register/api-types/entityQueryIR';
import { positionStepContextWithFallbackDirection } from '../pathBuilder/pathBuilderState';
import { collectLeafPaths, projectionOwningLeafPath } from './queryBuilderState';
import { ProjectionRow } from './ProjectionRow';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type Props = {
  projections: ProjectionField[];
  onChange: (projections: ProjectionField[]) => void;
  /** The query tree - columns anchored to a filter leaf are edited under that leaf in `QueryTree`,
   *  so this section only shows the standalone (never-filtered / `path: []`) ones. */
  root: QueryNode;
  leafCtx: LeafContext;
};

/**
 * The builder's standalone "Columns" section (#2354 phase 8): columns whose traversal isn't tied to
 * a filter leaf. A column projected through a `[...]`-scoped hop is edited inline under that leaf
 * (#3162); everything else - a never-filtered traversal, or a bare root-field read - lives here.
 */
export const ProjectionEditor = ({ projections, onChange, root, leafCtx }: Props) => {
  const { schemas, relationSchemas, getFieldGroupAccess, rootPosition } = leafCtx;
  const hopArgs = { rootPosition, schemas, relationSchemas, getFieldGroupAccess };
  const leafPaths = collectLeafPaths(root);
  const isStandalone = (projection: ProjectionField) =>
    projectionOwningLeafPath(projection.path, leafPaths) === undefined;

  const standalone = projections.filter(isStandalone);

  const replace = (target: ProjectionField, next: ProjectionField) =>
    onChange(projections.map(projection => (projection === target ? next : projection)));
  const remove = (target: ProjectionField) =>
    onChange(projections.filter(projection => projection !== target));

  const addProjection = () => {
    const context = positionStepContextWithFallbackDirection({ ...hopArgs, steps: [], depth: 0 });
    if (!context.options[0]) return;
    onChange([...projections, { path: [context.options[0].step], fieldId: '_name' }]);
  };

  if (standalone.length === 0) {
    return (
      <div className={styles.columns}>
        <button type="button" className={styles.addBtn} onClick={addProjection}>
          <TbPlus size={11} /> Add column
        </button>
      </div>
    );
  }

  return (
    <div className={styles.columns}>
      <div className={styles.columnsHeader}>
        <span className={styles.previewLabel}>Columns</span>
        <span className={styles.matchHint}>
          traversed values, selectable as table columns under Manage fields
        </span>
      </div>

      {standalone.map((projection, index) => (
        <ProjectionRow
          key={projections.indexOf(projection)}
          projection={projection}
          onChange={next => replace(projection, next)}
          onRemove={() => remove(projection)}
          leafCtx={leafCtx}
          label={`column ${index + 1}`}
        />
      ))}

      <button type="button" className={styles.addBtn} onClick={addProjection}>
        <TbPlus size={11} /> Add column
      </button>
    </div>
  );
};
