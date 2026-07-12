import styles from './EmptyState.module.css';

export const EmptyState = (props: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) => {
  if (props.compact) {
    return <div className={styles.compact}>{props.title}</div>;
  }

  return (
    <div className={styles.empty}>
      {props.icon && <div className={styles.emptyIcon}>{props.icon}</div>}
      <div className={styles.emptyTitle}>{props.title}</div>
      {props.subtitle && <div className={styles.emptySub}>{props.subtitle}</div>}
      {props.action}
    </div>
  );
};
