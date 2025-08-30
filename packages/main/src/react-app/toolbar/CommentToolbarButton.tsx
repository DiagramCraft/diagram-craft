import { TbMessageCircle } from 'react-icons/tb';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { useEventListener } from '../hooks/useEventListener';
import { useDiagram, useApplication } from '../../application';
import { useRedraw } from '../hooks/useRedraw';

export const CommentToolbarButton = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const application = useApplication();

  // Listen to selection changes
  useEventListener(diagram.selectionState, 'add', redraw);
  useEventListener(diagram.selectionState, 'remove', redraw);
  useEventListener(diagram.document.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.document.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.document.commentManager, 'commentRemoved', redraw);

  const selType = diagram.selectionState.getSelectionType();
  const selElement = diagram.selectionState.elements?.[0];

  const commentCount = diagram.document.commentManager
    .getAllCommentsForDiagram(diagram)
    .filter(c => !c.isReply())
    .filter(c => c.state !== 'resolved')
    .filter(c => (selType === 'empty' ? c.type === 'diagram' : c.element === selElement)).length;

  // Determine if button should be visible
  if (!(selType === 'empty' || selType === 'single-node' || selType === 'single-edge')) {
    return null;
  }

  const tooltipMessage = selElement ? `Comments for ${selElement.type}` : 'Comments for diagram';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Tooltip message={tooltipMessage}>
        <Toolbar.Button onClick={() => application.actions.COMMENT_ADD!.execute()}>
          <TbMessageCircle />
        </Toolbar.Button>
      </Tooltip>
      {commentCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '-1px',
            right: '-1px',
            backgroundColor: 'var(--highlight-reverse-bg)',
            color: 'var(--highlight-reverse-fg)',
            borderRadius: '50%',
            width: '8px',
            height: '8px',
            border: '1px solid var(--primary-bg)'
          }}
        ></div>
      )}
    </div>
  );
};
