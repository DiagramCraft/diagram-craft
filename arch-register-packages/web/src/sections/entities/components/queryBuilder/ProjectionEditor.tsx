import type { ProjectionField, QueryNode } from '@arch-register/api-types/entityQueryIR';
import { collectProjectionAnchorPaths, projectionAnchorPath } from './queryBuilderState';
import { ProjectionRow } from './ProjectionRow';
import type { LeafContext } from './types';
import styles from './queryBuilder.module.css';

type Props = {
  projections: ProjectionField[];
  onChange: (projections: ProjectionField[]) => void;
  /** The query tree - columns are added and edited inline in the hop's `[...]` panel (#3162). This
   *  section only *displays* columns that aren't anchored to any hop (e.g. a leaf they were
   *  attached to was removed, or a `path: []` read from a saved view). */
  root: QueryNode;
  leafCtx: LeafContext;
};

/**
 * Read-out for projection columns that aren't tied to a hop in the tree - so they stay visible and
 * removable rather than lingering invisibly on the query. New columns are added from a hop's
 * `[...]` panel (`+ column`), never here.
 */
export const ProjectionEditor = ({ projections, onChange, root, leafCtx }: Props) => {
  const anchorPaths = collectProjectionAnchorPaths(root);
  const unanchored = projections.filter(
    projection => projectionAnchorPath(projection.path, anchorPaths) === undefined
  );

  if (unanchored.length === 0) return null;

  const replace = (target: ProjectionField, next: ProjectionField) =>
    onChange(projections.map(projection => (projection === target ? next : projection)));
  const remove = (target: ProjectionField) =>
    onChange(projections.filter(projection => projection !== target));

  return (
    <div className={styles.columns}>
      <div className={styles.columnsHeader}>
        <span className={styles.previewLabel}>Other columns</span>
        <span className={styles.matchHint}>not tied to a filter hop</span>
      </div>

      {unanchored.map((projection, index) => (
        <ProjectionRow
          key={projections.indexOf(projection)}
          projection={projection}
          onChange={next => replace(projection, next)}
          onRemove={() => remove(projection)}
          leafCtx={leafCtx}
          label={`column ${index + 1}`}
        />
      ))}
    </div>
  );
};
