import { useCallback, useEffect, useState } from 'react';
import { TbMessageCircle } from 'react-icons/tb';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { useEventListener } from '../hooks/useEventListener';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { useDiagram } from '../../application';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { CommentDialog } from './CommentDialog';

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
  const diagram = useDiagram();
  const [selectionType, setSelectionType] = useState<SelectionType | undefined>(undefined);
  const [selectedElement, setSelectedElement] = useState<DiagramElement | undefined>(undefined);
  const [unresolvedCommentCount, setUnresolvedCommentCount] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Update unresolved comments count
  const updateUnresolvedComments = useCallback(() => {
    try {
      const commentManager = diagram.document.commentManager;

      if (selectedElement) {
        // Count unresolved comments on selected element
        const elementComments = commentManager.getCommentsForElement(selectedElement);
        const unresolvedCount = elementComments.filter(
          comment => comment.state === 'unresolved'
        ).length;
        setUnresolvedCommentCount(unresolvedCount);
      } else if (selectionType === 'empty') {
        // Count unresolved comments on diagram
        const diagramComments = commentManager.getCommentsForDiagram(diagram);
        const unresolvedCount = diagramComments.filter(
          comment => comment.state === 'unresolved'
        ).length;
        setUnresolvedCommentCount(unresolvedCount);
      } else {
        setUnresolvedCommentCount(0);
      }
    } catch (error) {
      console.warn('Error updating comment state:', error);
      setUnresolvedCommentCount(0);
    }
  }, [diagram, selectedElement, selectionType]);

  // Listen to selection changes
  useEventListener(diagram.selectionState, 'add', updateSelection);
  useEventListener(diagram.selectionState, 'remove', updateSelection);
  useEffect(updateSelection, [updateSelection]);

  // Listen to comment changes
  useEventListener(diagram.document.commentManager, 'commentAdded', updateUnresolvedComments);
  useEventListener(diagram.document.commentManager, 'commentUpdated', updateUnresolvedComments);
  useEventListener(diagram.document.commentManager, 'commentRemoved', updateUnresolvedComments);
  useEffect(updateUnresolvedComments, [updateUnresolvedComments]);

  // Determine if button should be visible
  const shouldShowButton =
    selectionType === 'empty' || selectionType === 'single-node' || selectionType === 'single-edge';

  const handleClick = () => {
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  if (!shouldShowButton) {
    return null;
  }

  const tooltipMessage = selectedElement
    ? `Comments for ${selectedElement.type}`
    : 'Comments for diagram';

  return (
    <>
      <Tooltip message={tooltipMessage}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Toolbar.Button onClick={handleClick}>
            <TbMessageCircle />
          </Toolbar.Button>
          {unresolvedCommentCount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                backgroundColor: 'var(--highlight-reverse-bg)',
                color: 'var(--highlight-reverse-fg)',
                borderRadius: '50%',
                width: '12px',
                height: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold'
              }}
            >
              {unresolvedCommentCount}
            </div>
          )}
        </div>
      </Tooltip>

      <CommentDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        diagram={diagram}
        selectedElement={selectedElement}
      />
    </>
  );
};
