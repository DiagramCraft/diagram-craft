import { Title } from '../../../components/Title';
import styles from './VendorManagementPlaceholderScreen.module.css';

/**
 * Shared empty state for every section of this app.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real vendor register / contracts / spend / risk content lands in later sub-issues
 * of #3153.
 */
export const VendorManagementPlaceholderScreen = ({ title }: { title: string }) => {
  return (
    <div className={styles.screen}>
      <Title title={title} />
      <div className={styles.empty}>Nothing here yet.</div>
    </div>
  );
};
