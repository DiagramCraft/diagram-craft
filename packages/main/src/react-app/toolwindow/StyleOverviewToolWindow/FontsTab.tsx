import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState } from 'react';
import { FontsPanel } from './FontsPanel';
import { FontsSortMenu } from './FontsSortMenu';
import { ToolWindow } from '../ToolWindow';
import {
  collectFonts,
  type FontCombination,
  type FontScope,
  type FontSortOrder,
  sortFonts
} from './fontsPanelUtils';

export const FontsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const [scope, setScope] = useState<FontScope>('current-diagram');
  const [sortOrder, setSortOrder] = useState<FontSortOrder>('count-desc');

  const fontMap = collectFonts(scope, diagram);
  const fonts = sortFonts(Array.from(fontMap.values()), sortOrder);

  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);

  const handleFontClick = useCallback(
    (combo: FontCombination) => {
      const elementsToSelect =
        scope === 'current-diagram'
          ? combo.elements.filter(el => el.layer.diagram === diagram)
          : combo.elements;

      diagram.selection.clear();
      diagram.selection.setElements(elementsToSelect);
      redraw();
    },
    [diagram, scope, redraw]
  );

  return (
    <>
      <ToolWindow.TabActions>
        <FontsSortMenu
          scope={scope}
          sortOrder={sortOrder}
          onScopeChange={setScope}
          onSortOrderChange={setSortOrder}
        />
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <FontsPanel fonts={fonts} onFontClick={handleFontClick} />
      </ToolWindow.TabContent>
    </>
  );
};
