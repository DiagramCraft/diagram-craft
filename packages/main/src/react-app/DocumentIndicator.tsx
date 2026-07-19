import { TbLock, TbLockOff } from 'react-icons/tb';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { useApplication } from '../application';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import styles from './DocumentIndicator.module.css';

export const DocumentIndicator = () => {
  const redraw = useRedraw();
  const application = useApplication();
  const document = application.model.activeDocument;

  useEventListener(document, 'diagramChanged', redraw);
  useEventListener(application.model, 'activeDocumentChange', redraw);

  return (
    <button
      type={'button'}
      className={styles.isDocumentIndicator}
      data-locked={document.locked}
      onClick={() => application.actions['DOCUMENT_TOGGLE_LOCK']?.execute()}
    >
      <Tooltip
        message={document.locked ? 'Document locked' : 'Lock document'}
        element={document.locked ? <TbLock /> : <TbLockOff />}
      />
    </button>
  );
};
