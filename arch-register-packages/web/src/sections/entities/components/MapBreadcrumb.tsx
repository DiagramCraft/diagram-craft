import styles from './MapBreadcrumb.module.css';

export type MapFocusEntry = { uid: string; name: string };

type MapBreadcrumbProps = {
  rootLabel: string;
  stack: MapFocusEntry[];
  /** -1 navigates back to the root (unfocused) view; otherwise the index within `stack`. */
  onNavigate: (index: number) => void;
};

export const MapBreadcrumb = ({ rootLabel, stack, onNavigate }: MapBreadcrumbProps) => {
  if (stack.length === 0) return null;

  return (
    <nav className={styles.breadcrumb} aria-label="Map focus path">
      <button type="button" className={styles.crumb} onClick={() => onNavigate(-1)}>
        {rootLabel}
      </button>
      {stack.map((entry, index) => {
        const isActive = index === stack.length - 1;
        return (
          <span key={entry.uid} className={styles.crumbGroup}>
            <span className={styles.sep}>›</span>
            {isActive ? (
              <span className={styles.crumbActive}>{entry.name}</span>
            ) : (
              <button type="button" className={styles.crumb} onClick={() => onNavigate(index)}>
                {entry.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
};
