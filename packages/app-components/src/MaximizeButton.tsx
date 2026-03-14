import { TbArrowsDiagonal } from 'react-icons/tb';
import styles from './MaximizeButton.module.css';

type Props = {
  onClick: () => void;
};

export const MaximizeButton = (props: Props) => {
  return (
    <button onClick={props.onClick} type="button" className={styles.cMaximizeButton}>
      <TbArrowsDiagonal />
    </button>
  );
};
