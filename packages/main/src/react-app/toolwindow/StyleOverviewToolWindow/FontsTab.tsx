import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState, useRef, useEffect } from 'react';
import { FontsPanel } from './FontsPanel';
import { ToolWindow } from '../ToolWindow';
import { collectFonts, type FontCombination, type StylesheetGroup } from './fontsPanelUtils';
import { isNode } from '@diagram-craft/model/diagramElement';

export const FontsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  // Track if selection change is from clicking in this panel
  const isInternalSelectionRef = useRef(false);

  // Cache the currently displayed groups
  const [cachedGroups, setCachedGroups] = useState<StylesheetGroup[]>([]);

  // Function to recalculate groups based on current selection
  const recalculateGroups = useCallback(() => {
    const selectedNodes = diagram.selection.elements.filter(isNode);
    const groups = collectFonts(
      diagram,
      selectedNodes.length > 0 ? [...selectedNodes] : undefined
    );
    setCachedGroups(groups);
  }, [diagram]);

  // Initialize cache on mount
  useEffect(() => {
    recalculateGroups();
  }, [recalculateGroups]);

  // Handle selection changes - only update cache for external changes
  const handleSelectionChange = useCallback(() => {
    if (isInternalSelectionRef.current) {
      // Internal selection - don't update cache, just redraw
      isInternalSelectionRef.current = false;
      redraw();
    } else {
      // External selection - update cache and redraw
      recalculateGroups();
      redraw();
    }
  }, [recalculateGroups, redraw]);

  // Element changes should always update the cache
  useEventListener(diagram, 'elementChange', () => {
    recalculateGroups();
    redraw();
  });
  useEventListener(diagram, 'elementAdd', () => {
    recalculateGroups();
    redraw();
  });
  useEventListener(diagram, 'elementRemove', () => {
    recalculateGroups();
    redraw();
  });
  useEventListener(diagram, 'diagramChange', () => {
    recalculateGroups();
    redraw();
  });
  useEventListener(diagram.document, 'diagramChanged', () => {
    recalculateGroups();
    redraw();
  });

  // Selection changes need conditional handling
  useEventListener(diagram.selection, 'change', handleSelectionChange);

  const handleFontClick = useCallback(
    (combo: FontCombination) => {
      // Mark as internal selection
      isInternalSelectionRef.current = true;

      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      // Note: redraw will be called by handleSelectionChange
    },
    [diagram]
  );

  return (
    <>
      <ToolWindow.TabContent>
        <FontsPanel groups={cachedGroups} onFontClick={handleFontClick} />
      </ToolWindow.TabContent>
    </>
  );
};
