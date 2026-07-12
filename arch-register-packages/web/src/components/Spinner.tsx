import styles from './Spinner.module.css';

type Props = {
  size?: 'sm' | 'md';
};

export const Spinner = ({ size = 'md' }: Props) => (
  <div className={size === 'sm' ? styles.sm : styles.md} />
);
