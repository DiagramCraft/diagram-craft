import styles from './FullScreenProgress.module.css';
import { useEffect, useState } from 'react';

type Props = {
  message: string;
  isError: boolean;
};

export const FullScreenProgress = (props: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 1);
  }, []);

  return (
    <div className={styles.icFullscreenProgress} data-visible={visible}>
      <div className={styles.eMessage}>{props.message}</div>
    </div>
  );
};
