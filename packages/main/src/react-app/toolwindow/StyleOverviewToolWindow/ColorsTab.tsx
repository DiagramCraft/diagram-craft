import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState, useRef, useEffect } from 'react';
import { ColorsPanel } from './ColorsPanel';
import { ToolWindow } from '../ToolWindow';
import { collectColors, type ColorInfo, type StylesheetGroup } from './colorsPanelUtils';

export const ColorsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  // Track if selection change is from clicking in this panel
  const isInternalSelectionRef = useRef(false);

  // Cache the currently displayed groups
  const [cachedGroups, setCachedGroups] = useState<StylesheetGroup[]>([]);

  // Function to recalculate groups based on current selection
  const recalculateGroups = useCallback(() => {
    const selectedElements = diagram.selection.elements;
    const groups = collectColors(
      diagram,
      selectedElements.length > 0 ? [...selectedElements] : undefined
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

  const handleColorClick = useCallback(
    (color: ColorInfo) => {
      // Mark as internal selection
      isInternalSelectionRef.current = true;

      diagram.selection.clear();
      diagram.selection.setElements(color.elements);
      // Note: redraw will be called by handleSelectionChange
    },
    [diagram]
  );

  return (
    <>
      <ToolWindow.TabContent>
        <ColorsPanel groups={cachedGroups} onColorClick={handleColorClick} />
      </ToolWindow.TabContent>
    </>
  );
};
