import styles from './FullScreenProgress.module.css';
import { useEffect, useState } from 'react';

type Props = {
  message: string;
  isError: boolean;
};

export const FullScreenProgress = (props: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 0.5);
  }, []);

  return (
    <div
      className={
        `${styles.cmpFullscreenProgress} ${visible ? styles.cmpFullscreenProgressVisible : ''}`
      }
    >
      <div>{props.message}</div>
    </div>
  );
};
