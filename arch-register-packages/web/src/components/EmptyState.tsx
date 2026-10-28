import styles from './EmptyState.module.css';

const TONE_CLASS = {
  neutral: '',
  good: styles.toneGood,
  warning: styles.toneWarning,
  error: styles.toneError
};

export const EmptyState = (props: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
  framed?: boolean;
  /** Less vertical padding, for empty states inside a page or tab rather than filling a page. */
  dense?: boolean;
  /** Colours the icon to signal the state: `good` (e.g. nothing wrong), `warning` or `error`. */
  tone?: 'neutral' | 'good' | 'warning' | 'error';
}) => {
  if (props.compact) {
    return <div className={styles.compact}>{props.title}</div>;
  }

  return (
    <div
      className={`${props.framed ? styles.framed : styles.empty} ${props.dense ? styles.dense : ''}`}
    >
      {props.icon && (
        <div
          className={`${props.framed ? styles.framedIcon : styles.emptyIcon} ${TONE_CLASS[props.tone ?? 'neutral']}`}
        >
          {props.icon}
        </div>
      )}
      <div className={props.framed ? styles.framedTitle : styles.emptyTitle}>{props.title}</div>
      {props.subtitle && (
        <div className={props.framed ? styles.framedSub : styles.emptySub}>{props.subtitle}</div>
      )}
      {props.action}
    </div>
  );
};
