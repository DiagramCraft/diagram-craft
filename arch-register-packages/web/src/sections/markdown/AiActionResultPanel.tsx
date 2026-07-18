import { Dialog } from '@diagram-craft/app-components/Dialog';
import { SafeMarkdown } from '../../components/SafeMarkdown';
import type { RunAiActionResponse } from '@arch-register/api-types/projectContract';
import styles from './AiActionResultPanel.module.css';

export const AiActionResultPanel = ({
  open,
  result,
  loading,
  errorMessage,
  onClose,
  onContinueInConversation
}: {
  open: boolean;
  result: RunAiActionResponse | null;
  loading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onContinueInConversation: (result: RunAiActionResponse) => void;
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={result?.actionName ?? 'AI action'}
      width={640}
      buttons={[
        { label: 'Close', type: 'cancel', onClick: onClose },
        {
          label: 'Continue in AI conversation',
          type: 'default',
          onClick: () => result && onContinueInConversation(result),
          disabled: !result
        }
      ]}
    >
      <div className={styles.body}>
        {loading && <div className={styles.status}>Running…</div>}
        {!loading && errorMessage && <div className={styles.error}>{errorMessage}</div>}
        {!loading && !errorMessage && result && (
          <div className={styles.answer}>
            <SafeMarkdown text={result.answer} />
          </div>
        )}
      </div>
    </Dialog>
  );
};
