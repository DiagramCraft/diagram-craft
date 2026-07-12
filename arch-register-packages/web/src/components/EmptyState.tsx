import styles from './EmptyState.module.css';

export const EmptyState = (props: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
  framed?: boolean;
}) => {
  if (props.compact) {
    return <div className={styles.compact}>{props.title}</div>;
  }

  return (
    <div className={props.framed ? styles.framed : styles.empty}>
      {props.icon && (
        <div className={props.framed ? styles.framedIcon : styles.emptyIcon}>{props.icon}</div>
      )}
      <div className={props.framed ? styles.framedTitle : styles.emptyTitle}>{props.title}</div>
      {props.subtitle && (
        <div className={props.framed ? styles.framedSub : styles.emptySub}>{props.subtitle}</div>
      )}
      {props.action}
    </div>
  );
};
