import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

export const CommentsToolWindowBadge = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram.document.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.document.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.document.commentManager, 'commentRemoved', redraw);

  const commentCount = diagram.document.commentManager
    .getAllCommentsForDiagram(diagram)
    .filter(c => !c.isReply())
    .filter(c => c.state !== 'resolved').length;

  if (commentCount === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '6px',
        right: '6px',
        backgroundColor: 'var(--highlight-reverse-bg)',
        borderRadius: '50%',
        width: '8px',
        height: '8px',
        border: '1px solid var(--primary-bg)'
      }}
    ></div>
  );
};
