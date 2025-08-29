import {useCallback, useEffect, useState} from 'react';
import {TbMessageCircle} from 'react-icons/tb';
import {Toolbar} from '@diagram-craft/app-components/Toolbar';
import {Tooltip} from '@diagram-craft/app-components/Tooltip';
import {useEventListener} from '../hooks/useEventListener';
import {SelectionType} from '@diagram-craft/model/selectionState';
import {useDiagram} from '../../application';
import {DiagramElement} from '@diagram-craft/model/diagramElement';
import {CommentPopover} from './CommentPopover';
import {useRedraw} from '../hooks/useRedraw';

/**
 * CommentToolbarButton provides a toolbar button for accessing comments functionality.
 * Designed for use in ContextSpecificToolbar.
 *
 * Behavior:
 * - Shows when no selection (0 elements) or single element selection (1 element)
 * - Hides when multiple elements are selected
 * - Highlights (primary color) when there are unresolved comments:
 *   - For diagram comments when no selection
 *   - For element comments when single element is selected
 * - Uses default icon size to match other context toolbar buttons
 * - Clicking opens comment dialog for adding new comments
 */
export const CommentToolbarButton = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const [selectionType, setSelectionType] = useState<SelectionType | undefined>(undefined);
  const [selectedElement, setSelectedElement] = useState<DiagramElement | undefined>(undefined);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Update selection state
  const updateSelection = useCallback(() => {
    const selection = diagram.selectionState.getSelectionType();
    setSelectionType(selection);

    if (selection === 'single-node' || selection === 'single-edge') {
      const elements = [...diagram.selectionState.nodes, ...diagram.selectionState.edges];
      setSelectedElement(elements[0]);
    } else {
      setSelectedElement(undefined);
    }
  }, [diagram]);

  // Listen to selection changes
  useEventListener(diagram.selectionState, 'add', updateSelection);
  useEventListener(diagram.selectionState, 'remove', updateSelection);
  useEffect(updateSelection, [updateSelection]);

  // Listen to comment changes
  useEventListener(diagram.document.commentManager, 'commentAdded', redraw);
  useEventListener(diagram.document.commentManager, 'commentUpdated', redraw);
  useEventListener(diagram.document.commentManager, 'commentRemoved', redraw);

  const commentCount = diagram.document.commentManager
    .getAllCommentsForDiagram(diagram)
    .filter(c => !c.isReply())
    .filter(c => c.state !== 'resolved')
    .filter(c => {
      if (selectionType === 'empty') return c.type === 'diagram';
      return c.element === selectedElement;
    }).length;

  // Determine if button should be visible
  const shouldShowButton =
    selectionType === 'empty' || selectionType === 'single-node' || selectionType === 'single-edge';

  const handlePopoverChange = (open: boolean) => {
    setIsPopoverOpen(open);
  };

  if (!shouldShowButton) {
    return null;
  }

  const tooltipMessage = selectedElement
    ? `Comments for ${selectedElement.type}`
    : 'Comments for diagram';

  return (
    <CommentPopover
      open={isPopoverOpen}
      onOpenChange={handlePopoverChange}
      diagram={diagram}
      selectedElement={selectedElement}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Tooltip message={tooltipMessage}>
          <Toolbar.Button>
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
    </CommentPopover>
  );
};
