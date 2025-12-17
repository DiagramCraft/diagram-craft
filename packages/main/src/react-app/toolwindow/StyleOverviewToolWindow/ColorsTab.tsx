import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState } from 'react';
import { ColorsPanel } from './ColorsPanel';
import { ColorsSortMenu } from './ColorsSortMenu';
import { ToolWindow } from '../ToolWindow';
import {
  collectColors,
  filterColors,
  sortColors,
  type ColorCombination,
  type ColorScope,
  type ColorSortOrder,
  type ColorFilter
} from './colorsPanelUtils';

export const ColorsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const [scope, setScope] = useState<ColorScope>('current-diagram');
  const [sortOrder, setSortOrder] = useState<ColorSortOrder>('count-desc');
  const [filter, setFilter] = useState<ColorFilter>('all');

  const colorMap = collectColors(scope, diagram);
  const filteredColors = filterColors(Array.from(colorMap.values()), filter);
  const colors = sortColors(filteredColors, sortOrder);

  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);

  const handleColorClick = useCallback(
    (combo: ColorCombination) => {
      const allElements = [
        ...combo.usage.background,
        ...combo.usage.text,
        ...combo.usage.border
      ];

      const elementsToSelect =
        scope === 'current-diagram'
          ? allElements.filter(el => el.layer.diagram === diagram)
          : allElements;

      diagram.selection.clear();
      diagram.selection.setElements(elementsToSelect);
      redraw();
    },
    [diagram, scope, redraw]
  );

  const handleUsageClick = useCallback(
    (combo: ColorCombination, usageType: 'background' | 'text' | 'border') => {
      const elements = combo.usage[usageType];

      const elementsToSelect =
        scope === 'current-diagram'
          ? elements.filter(el => el.layer.diagram === diagram)
          : elements;

      diagram.selection.clear();
      diagram.selection.setElements(elementsToSelect);
      redraw();
    },
    [diagram, scope, redraw]
  );

  return (
    <>
      <ToolWindow.TabActions>
        <ColorsSortMenu
          scope={scope}
          sortOrder={sortOrder}
          filter={filter}
          onScopeChange={setScope}
          onSortOrderChange={setSortOrder}
          onFilterChange={setFilter}
        />
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <ColorsPanel
          colors={colors}
          onColorClick={handleColorClick}
          onUsageClick={handleUsageClick}
        />
      </ToolWindow.TabContent>
    </>
  );
};
