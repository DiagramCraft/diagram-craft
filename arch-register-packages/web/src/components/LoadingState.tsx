import { Spinner } from './Spinner';
import styles from './LoadingState.module.css';

type Props = {
  text?: string;
  size?: 'sm' | 'md';
};

export const LoadingState = ({ text, size = 'md' }: Props) => (
  <div className={styles.root}>
    <Spinner size={size} />
    {text && <p className={styles.text}>{text}</p>}
  </div>
);
