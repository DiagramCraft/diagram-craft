import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback } from 'react';
import { ColorsPanel } from './ColorsPanel';
import { ToolWindow } from '../ToolWindow';
import { collectColors, type ColorInfo } from './colorsPanelUtils';

export const ColorsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  // Get selected elements if any
  const selectedElements = diagram.selection.elements;

  const groups = collectColors(diagram, selectedElements.length > 0 ? [...selectedElements] : undefined);

  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);
  useEventListener(diagram.selection, 'change', redraw);

  const handleColorClick = useCallback(
    (color: ColorInfo) => {
      diagram.selection.clear();
      diagram.selection.setElements(color.elements);
      redraw();
    },
    [diagram, redraw]
  );

  return (
    <>
      <ToolWindow.TabContent>
        <ColorsPanel groups={groups} onColorClick={handleColorClick} />
      </ToolWindow.TabContent>
    </>
  );
};
