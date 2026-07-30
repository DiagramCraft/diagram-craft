import type { ReactNode } from 'react';
import styles from './Caption.module.css';

export const Caption = ({
  caption,
  numbered,
  children
}: {
  caption?: string;
  /** Always a string here (MDX/JSX attributes are string-only); the Slate
   * element's equivalent field is a `boolean`. See captionMdxRule. */
  numbered?: string;
  children?: ReactNode;
}) => {
  return (
    <figure className={styles.container}>
      <div className={styles.body}>{children}</div>
      {caption && (
        <figcaption className={styles.caption}>
          {numbered === 'true' && <span className={styles.figureLabel} />}
          {caption}
        </figcaption>
      )}
    </figure>
  );
};
