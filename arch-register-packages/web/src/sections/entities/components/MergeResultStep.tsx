import { TbCheck } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { MergeExecuteResponse } from '@arch-register/api-types/entityMergeContract';
import styles from './MergeWizardDialog.module.css';

type Props = {
  result: MergeExecuteResponse;
  onViewEntity: (entityPublicId: string) => void;
  onClose: () => void;
};

export const MergeResultStep = ({ result, onViewEntity, onClose }: Props) => (
  <div className={styles.section}>
    <div className={styles.doneCheck}>
      <TbCheck size={20} />
    </div>
    <div className={styles.doneTitle}>Merged into {result.entity._name}</div>
    <div className={styles.doneSub}>The source entity has been retired and now resolves here.</div>
    <div className={styles.doneActions}>
      <Button variant="primary" onClick={() => onViewEntity(result.entity._publicId)}>
        View merged entity
      </Button>
      <Button onClick={onClose}>Close</Button>
    </div>
  </div>
);
