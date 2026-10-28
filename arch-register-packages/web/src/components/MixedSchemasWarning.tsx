import { TbAlertTriangle } from 'react-icons/tb';
import styles from './MixedSchemasWarning.module.css';

/** Config-bar hint for views that map fields across schemas: entities lacking a field are omitted. */
export const MixedSchemasWarning = () => (
  <span className={styles.warning}>
    <TbAlertTriangle size={12} />
    Mixed schemas - some entities may not show
  </span>
);
