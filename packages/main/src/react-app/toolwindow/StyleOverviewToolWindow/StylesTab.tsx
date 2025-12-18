import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState, useRef, useEffect } from 'react';
import { StylesPanel, TextStylesPanel } from './StylesPanel';
import { ToolWindow } from '../ToolWindow';
import {
  collectStyles,
  collectTextStyles,
  type StyleCombination,
  type TextStyleCombination,
  type StyleFilterType,
  type StylesheetGroup,
  type TextStylesheetGroup
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
  const [cachedVisualGroups, setCachedVisualGroups] = useState<StylesheetGroup[]>([]);
  const [cachedTextGroups, setCachedTextGroups] = useState<TextStylesheetGroup[]>([]);

  // Function to recalculate groups based on current selection
  const recalculateGroups = useCallback(() => {
    const selectedElements = diagram.selection.elements;

    if (filterType !== 'text') {
      const visualGroups = collectStyles(
        diagram,
        selectedElements.length > 0 ? [...selectedElements] : undefined,
        filterType
      );
      setCachedVisualGroups(visualGroups);
    }

    if (filterType === 'text') {
      const textGroups = collectTextStyles(
        diagram,
        selectedElements.length > 0 ? [...selectedElements] : undefined
      );
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
  useEventListener(diagram, 'elementChange', () => {
    recalculateGroups();
    redrawDebounce();
  });
  useEventListener(diagram, 'elementAdd', () => {
    recalculateGroups();
    redrawDebounce();
  });
  useEventListener(diagram, 'elementRemove', () => {
    recalculateGroups();
    redrawDebounce();
  });
  useEventListener(diagram, 'diagramChange', () => {
    recalculateGroups();
    redrawDebounce();
  });
  useEventListener(diagram.document, 'diagramChanged', () => {
    recalculateGroups();
    redrawDebounce();
  });

  // Selection changes need conditional handling
  useEventListener(diagram.selection, 'change', handleSelectionChange);

  const handleStyleClick = useCallback(
    (combo: StyleCombination) => {
      // Mark as internal selection
      isInternalSelectionRef.current = true;

      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      // Note: redraw will be called by handleSelectionChange
    },
    [diagram]
  );

  const handleTextStyleClick = useCallback(
    (combo: TextStyleCombination) => {
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
          onTextStyleClick={handleTextStyleClick}
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
