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
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import type { ElementProps } from '@diagram-craft/model/diagramProps';
import { DynamicAccessor } from '@diagram-craft/utils/propertyPath';

export const StylesTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const [filterType, setFilterType] = useState<StyleFilterType>('all');

  // Track if selection change is from clicking in this panel
  const isInternalSelectionRef = useRef(false);

  const [visualGroups, setVisualGroups] = useState<StylesheetGroup<StyleCombination>[]>([]);
  const [textGroups, setTextGroups] = useState<StylesheetGroup<TextStyleCombination>[]>([]);

  const recalculateGroups = useCallback(() => {
    const selectedElements = diagram.selection.elements;
    const elements = [...(selectedElements.length > 0 ? selectedElements : diagram.allElements())];

    if (filterType !== 'text') {
      const visualGroups = collectStyles(diagram, elements, filterType);
      setVisualGroups(visualGroups);
    }

    if (filterType === 'text') {
      const textGroups = collectTextStyles(diagram, elements);
      setTextGroups(textGroups);
    }
  }, [diagram, filterType]);

  useEffect(() => recalculateGroups(), [recalculateGroups]);

  // Element changes should always update the cache
  const handleElementChange = useCallback(() => {
    recalculateGroups();
    redrawDebounce();
  }, [recalculateGroups, redrawDebounce]);

  // Handle selection changes - only update cache for external changes
  const handleSelectionChange = useCallback(() => {
    if (isInternalSelectionRef.current) {
      // Internal selection - don't update cache, just redraw
      isInternalSelectionRef.current = false;
      redraw();
    } else {
      handleElementChange();
    }
  }, [redraw, handleElementChange]);

  useEventListener(diagram, 'elementChange', handleElementChange);
  useEventListener(diagram, 'elementAdd', handleElementChange);
  useEventListener(diagram, 'elementRemove', handleElementChange);
  useEventListener(diagram, 'diagramChange', handleElementChange);
  useEventListener(diagram.document, 'diagramChanged', handleElementChange);

  useEventListener(diagram.selection, 'change', handleSelectionChange);

  const handleStyleClick = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      isInternalSelectionRef.current = true;

      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
    },
    [diagram]
  );

  const handleStyleReset = useCallback(
    (elements: DiagramElement[], differences: Partial<ElementProps>) => {
      const uow = new UnitOfWork(diagram, true);

      const accessor = new DynamicAccessor<ElementProps>();
      const paths = accessor.paths(differences);

      // Sort paths by length, longest first
      paths.sort((a, b) => b.length - a.length);

      for (const element of elements) {
        element.updateProps(props => {
          for (const path of paths) {
            accessor.set(props, path, undefined);
          }
        }, uow);
      }

      commitWithUndo(uow, 'Reset styles');
    },
    [diagram]
  );

  return (
    <ToolWindow.TabContent>
      {filterType === 'text' ? (
        <TextStylesPanel
          groups={textGroups}
          onStyleClick={handleStyleClick}
          onStyleReset={handleStyleReset}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      ) : (
        <StylesPanel
          groups={visualGroups}
          onStyleClick={handleStyleClick}
          onStyleReset={handleStyleReset}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      )}
    </ToolWindow.TabContent>
  );
};
