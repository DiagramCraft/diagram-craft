import { useCallback, useEffect, useState } from 'react';
import { TbMessageCircle } from 'react-icons/tb';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { useEventListener } from '../hooks/useEventListener';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { useDiagram } from '../../application';
import { DiagramElement } from '@diagram-craft/model/diagramElement';

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
 * - Clicking opens comment panel/dialog (TODO: implementation needed)
 */
export const CommentToolbarButton = () => {
  const diagram = useDiagram();
  const [selectionType, setSelectionType] = useState<SelectionType | undefined>(undefined);
  const [selectedElement, setSelectedElement] = useState<DiagramElement | undefined>(undefined);
  const [hasUnresolvedComments, setHasUnresolvedComments] = useState(false);

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

  // Update unresolved comments state
  const updateUnresolvedComments = useCallback(() => {
    try {
      const commentManager = diagram.document.commentManager;
      
      if (selectedElement) {
        // Check for unresolved comments on selected element
        const elementComments = commentManager.getCommentsForElement(selectedElement);
        const hasUnresolved = elementComments.some(comment => comment.state === 'unresolved');
        setHasUnresolvedComments(hasUnresolved);
      } else if (selectionType === 'empty') {
        // Check for unresolved comments on diagram
        const diagramComments = commentManager.getCommentsForDiagram(diagram);
        const hasUnresolved = diagramComments.some(comment => comment.state === 'unresolved');
        setHasUnresolvedComments(hasUnresolved);
      } else {
        setHasUnresolvedComments(false);
      }
    } catch (error) {
      console.warn('Error updating comment state:', error);
      setHasUnresolvedComments(false);
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
  const shouldShowButton = selectionType === 'empty' || 
                          selectionType === 'single-node' || 
                          selectionType === 'single-edge';

  const handleClick = () => {
    // TODO: Implement comment panel/dialog opening logic
    const commentManager = diagram.document.commentManager;
    const context = selectedElement ? 'element' : 'diagram';
    const comments = selectedElement 
      ? commentManager.getCommentsForElement(selectedElement)
      : commentManager.getCommentsForDiagram(diagram);
    
    console.log('Comment button clicked', { 
      context,
      selectionType, 
      selectedElement: selectedElement?.id,
      elementType: selectedElement?.type,
      hasUnresolvedComments,
      totalComments: comments.length,
      unresolvedCount: comments.filter(c => c.state === 'unresolved').length
    });
  };

  if (!shouldShowButton) {
    return null;
  }

  const tooltipMessage = selectedElement 
    ? `Comments for ${selectedElement.type}` 
    : 'Comments for diagram';

  return (
    <Tooltip message={tooltipMessage}>
      <Toolbar.Button
        onClick={handleClick}
        data-state={hasUnresolvedComments ? 'highlighted' : 'normal'}
        style={{
          backgroundColor: hasUnresolvedComments ? 'var(--primary-bg)' : undefined,
          color: hasUnresolvedComments ? 'var(--primary-fg)' : undefined,
          borderColor: hasUnresolvedComments ? 'var(--primary-bg)' : undefined
        }}
      >
        <TbMessageCircle />
      </Toolbar.Button>
    </Tooltip>
  );
};