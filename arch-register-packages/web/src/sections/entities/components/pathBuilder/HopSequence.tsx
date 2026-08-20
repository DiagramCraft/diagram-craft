import { Fragment, type ReactNode } from 'react';
import styles from './HopSequence.module.css';

export type HopSequenceProps<T> = {
  items: readonly T[];
  /** Renders one entry's full content, including whatever mix of controls that entry needs (a
   *  `HopPicker`, a plain schema `<select>`, per-entry remove/visibility/columns buttons, ...) -
   *  `HopSequence` itself only places the "›" separators and the trailing add button, so it stays
   *  agnostic to what an entry actually contains. */
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  onAdd: () => void;
  addLabel: string;
  addDisabled?: boolean;
  /** Whether to show a "›" before the add button - defaults to `items.length > 0`. A caller whose
   *  last entry isn't "ready" yet (e.g. a level with no schema/hop picked) can override this so
   *  the separator doesn't appear until adding another entry actually makes sense. */
  showAddSeparator?: boolean;
  className?: string;
};

/** A sequence of entries separated by "›", with an "add" button (itself preceded by "›" once
 *  there's something to add after) at the end - the shared shape behind both Traceability's hop
 *  row and Map's level row (#3040-map). */
export const HopSequence = <T,>({
  items,
  renderItem,x
  getItemKey,
  onAdd,
  addLabel,
  addDisabled = false,
  className
}: HopSequenceProps<T>) => (
  <div className={className ? `${styles.sequence} ${className}` : styles.sequence}>
    {items.map((item, index) => (
      <Fragment key={getItemKey ? getItemKey(item, index) : index}>
        {renderItem(item, index)}
      </Fragment>
    ))}
    <div className={styles.sequenceAddContainer}>
      <button type="button" className={styles.sequenceAdd} onClick={onAdd} disabled={addDisabled}>
        + {addLabel}
      </button>
    </div>
  </div>
);
