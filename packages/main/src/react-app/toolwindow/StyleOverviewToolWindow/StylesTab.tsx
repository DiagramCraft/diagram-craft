import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StylesPanel, TextStylesPanel } from './StylesPanel';
import { ToolWindow } from '../ToolWindow';
import {
  collectStyles,
  collectTextStyles,
  type StyleCombination,
  type StyleFilterType,
  type StylesheetGroup,
  type TextStyleCombination
} from './stylesPanelUtils';
import { debounce } from '@diagram-craft/utils/debounce';

export const StylesTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const [filterType, setFilterType] = useState<StyleFilterType>('all');

  // Track if selection change is from clicking in this panel
  const isInternalSelectionRef = useRef(false);

  // Cache the currently displayed groups
  const [cachedVisualGroups, setCachedVisualGroups] = useState<StylesheetGroup<StyleCombination>[]>(
    []
  );
  const [cachedTextGroups, setCachedTextGroups] = useState<StylesheetGroup<TextStyleCombination>[]>(
    []
  );

  // Function to recalculate groups based on current selection
  const recalculateGroups = useCallback(() => {
    const selectedElements = diagram.selection.elements;

    if (filterType !== 'text') {
      const visualGroups = collectStyles(
        diagram,
        [...(selectedElements.length > 0 ? selectedElements : diagram.allElements())],
        filterType
      );
      setCachedVisualGroups(visualGroups);
    }

    if (filterType === 'text') {
      const textGroups = collectTextStyles(diagram, [
        ...(selectedElements.length > 0 ? selectedElements : diagram.allElements())
      ]);
      setCachedTextGroups(textGroups);
    }
  }, [diagram, filterType]);

  // Initialize cache on mount and when filter changes
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
  const handleElementChange = useCallback(() => {
    recalculateGroups();
    redrawDebounce();
  }, [recalculateGroups, redrawDebounce]);

  useEventListener(diagram, 'elementChange', handleElementChange);
  useEventListener(diagram, 'elementAdd', handleElementChange);
  useEventListener(diagram, 'elementRemove', handleElementChange);
  useEventListener(diagram, 'diagramChange', handleElementChange);
  useEventListener(diagram.document, 'diagramChanged', handleElementChange);

  // Selection changes need conditional handling
  useEventListener(diagram.selection, 'change', handleSelectionChange);

  const handleStyleClick = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      // Mark as internal selection
      isInternalSelectionRef.current = true;

      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      // Note: redraw will be called by handleSelectionChange
    },
    [diagram]
  );

  return (
    <ToolWindow.TabContent>
      {filterType === 'text' ? (
        <TextStylesPanel
          groups={cachedTextGroups}
          onTextStyleClick={handleStyleClick}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      ) : (
        <StylesPanel
          groups={cachedVisualGroups}
          onStyleClick={handleStyleClick}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      )}
    </ToolWindow.TabContent>
  );
};
