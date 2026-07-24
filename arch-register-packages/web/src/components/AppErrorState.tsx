import { Button } from '@diagram-craft/app-components/Button';
import styles from './AppErrorState.module.css';

export const AppErrorState = (props: {
  title: string;
  message: string;
  details?: string | null;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  fullScreen?: boolean;
}) => {
  const content = (
    <div className={styles.panel} role="alert" aria-live="assertive">
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Something went wrong</div>
        <h1 className={styles.title}>{props.title}</h1>
        <p className={styles.message}>{props.message}</p>
      </div>
      {props.details ? <pre className={styles.details}>{props.details}</pre> : null}
      {props.primaryAction || props.secondaryAction ? (
        <div className={styles.actions}>
          {props.primaryAction ? (
            <Button variant="primary" onClick={props.primaryAction.onClick}>
              {props.primaryAction.label}
            </Button>
          ) : null}
          {props.secondaryAction ? (
            <Button onClick={props.secondaryAction.onClick}>{props.secondaryAction.label}</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (props.fullScreen) {
    return <div className={styles.shell}>{content}</div>;
  }

  return content;
};
