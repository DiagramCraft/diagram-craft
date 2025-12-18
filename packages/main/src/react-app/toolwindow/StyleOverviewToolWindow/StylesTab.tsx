import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState } from 'react';
import { StylesPanel, TextStylesPanel } from './StylesPanel';
import { ToolWindow } from '../ToolWindow';
import { collectStyles, collectTextStyles, type StyleCombination, type TextStyleCombination, type StyleFilterType } from './stylesPanelUtils';
import { debounce } from '@diagram-craft/utils/debounce';

export const StylesTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const [filterType, setFilterType] = useState<StyleFilterType>('all');

  // Get selected elements if any
  const selectedElements = diagram.selection.elements;

  // Collect styles based on filter type
  const visualGroups = filterType !== 'text'
    ? collectStyles(diagram, selectedElements.length > 0 ? [...selectedElements] : undefined, filterType)
    : [];

  const textGroups = filterType === 'text'
    ? collectTextStyles(diagram, selectedElements.length > 0 ? [...selectedElements] : undefined)
    : [];

  useEventListener(diagram, 'elementChange', redrawDebounce);
  useEventListener(diagram, 'elementAdd', redrawDebounce);
  useEventListener(diagram, 'elementRemove', redrawDebounce);
  useEventListener(diagram, 'diagramChange', redrawDebounce);
  useEventListener(diagram.document, 'diagramChanged', redrawDebounce);
  useEventListener(diagram.selection, 'change', redraw);

  const handleStyleClick = useCallback(
    (combo: StyleCombination) => {
      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      redraw();
    },
    [diagram, redraw]
  );

  const handleTextStyleClick = useCallback(
    (combo: TextStyleCombination) => {
      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      redraw();
    },
    [diagram, redraw]
  );

  return (
    <>
      <ToolWindow.TabContent>
        {filterType === 'text' ? (
          <TextStylesPanel
            groups={textGroups}
            onTextStyleClick={handleTextStyleClick}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
          />
        ) : (
          <StylesPanel
            groups={visualGroups}
            onStyleClick={handleStyleClick}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
          />
        )}
      </ToolWindow.TabContent>
    </>
  );
};
