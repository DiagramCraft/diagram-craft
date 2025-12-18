import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback } from 'react';
import { StylesPanel } from './StylesPanel';
import { ToolWindow } from '../ToolWindow';
import { collectStyles, type StyleCombination } from './stylesPanelUtils';
import { debounce } from '@diagram-craft/utils/debounce';

export const StylesTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  // Get selected elements if any
  const selectedElements = diagram.selection.elements;

  const groups = collectStyles(diagram, selectedElements.length > 0 ? [...selectedElements] : undefined);

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

  return (
    <>
      <ToolWindow.TabContent>
        <StylesPanel groups={groups} onStyleClick={handleStyleClick} />
      </ToolWindow.TabContent>
    </>
  );
};
