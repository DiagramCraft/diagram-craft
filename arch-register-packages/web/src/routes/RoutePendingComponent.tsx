import { LoadingState } from '../components/LoadingState';
import styles from './RoutePendingComponent.module.css';

export const RoutePendingComponent = () => (
  <div className={styles.root} role="status" aria-live="polite">
    <LoadingState text="Loading view…" />
  </div>
);
