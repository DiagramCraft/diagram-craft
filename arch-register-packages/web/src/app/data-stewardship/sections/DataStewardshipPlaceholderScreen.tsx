import { Title } from '../../../components/Title';
import styles from './DataStewardshipPlaceholderScreen.module.css';

/**
 * Shared empty state for every section of this app.
 *
 * This is a placeholder for the scaffold: each section renders only its title and an empty state
 * once enabled. Real My work / Stewardship / Classification / Change cases & exceptions /
 * Assessments content lands in later sub-issues of #3152.
 */
export const DataStewardshipPlaceholderScreen = ({ title }: { title: string }) => {
  return (
    <div className={styles.screen}>
      <Title title={title} />
      <div className={styles.empty}>Nothing here yet.</div>
    </div>
  );
};
