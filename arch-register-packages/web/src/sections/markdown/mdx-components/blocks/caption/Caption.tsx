import type { ReactNode } from 'react';
import styles from './Caption.module.css';

const alignClass = (align?: string) => {
  if (align === 'left') return styles.alignLeft;
  if (align === 'right') return styles.alignRight;
  return styles.alignCenter;
};

export const Caption = ({
  caption,
  align,
  numbered,
  children
}: {
  caption?: string;
  align?: string;
  /** Always a string here (MDX/JSX attributes are string-only); the Slate
   * element's equivalent field is a `boolean`. See captionMdxRule. */
  numbered?: string;
  children?: ReactNode;
}) => {
  return (
    <figure className={`${styles.container} ${alignClass(align)}`}>
      <div className={styles.body}>{children}</div>
      {caption && (
        <figcaption className={styles.caption}>
          {numbered === 'true' && <span className={styles.figureLabel}>Figure: </span>}
          {caption}
        </figcaption>
      )}
    </figure>
  );
};
