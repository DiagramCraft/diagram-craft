import { TbInfoCircle } from 'react-icons/tb';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import styles from './FieldDescriptionIcon.module.css';

type FieldDescriptionIconProps = {
  description?: string;
  /**
   * Render a non-interactive icon with a native title instead of a focusable tooltip trigger.
   * Use inside elements that are already interactive, such as sortable table headers, where
   * nesting a button would be invalid.
   */
  inline?: boolean;
};

/**
 * An (i) icon that shows a schema field's description in a tooltip. Renders nothing when the
 * field has no description, so fields from custom schemas look exactly as before.
 */
export const FieldDescriptionIcon = ({ description, inline }: FieldDescriptionIconProps) => {
  if (!description?.trim()) return null;

  if (inline) {
    return (
      <span className={styles.icon} title={description}>
        <TbInfoCircle size={13} />
      </span>
    );
  }

  return (
    <Tooltip
      message={description}
      element={
        <button type="button" className={styles.icon} aria-label={description}>
          <TbInfoCircle size={13} />
        </button>
      }
    />
  );
};
