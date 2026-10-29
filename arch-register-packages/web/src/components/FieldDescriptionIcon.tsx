import { TbInfoCircle } from 'react-icons/tb';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import styles from './FieldDescriptionIcon.module.css';

type FieldDescriptionIconProps = {
  description?: string;
  /** Shown in parentheses after the description (e.g. the field type); alone if there is none. */
  suffix?: string;
  /**
   * Render a non-interactive icon with a native title instead of a focusable tooltip trigger.
   * Use inside elements that are already interactive, such as sortable table headers, where
   * nesting a button would be invalid.
   */
  inline?: boolean;
};

/**
 * An (i) icon that shows a schema field's description in a tooltip. Renders nothing when the
 * field has neither a description nor a suffix, so fields from custom schemas look exactly as
 * before.
 */
export const FieldDescriptionIcon = ({
  description: rawDescription,
  suffix,
  inline
}: FieldDescriptionIconProps) => {
  const text = rawDescription?.trim();
  const description = text ? (suffix ? `${text} (${suffix})` : text) : suffix;
  if (!description) return null;

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
      delay={100}
      element={
        <button type="button" className={styles.icon} aria-label={description}>
          <TbInfoCircle size={13} />
        </button>
      }
    />
  );
};
