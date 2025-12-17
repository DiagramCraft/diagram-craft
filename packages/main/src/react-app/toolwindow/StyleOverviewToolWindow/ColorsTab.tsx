import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState } from 'react';
import { ColorsPanel } from './ColorsPanel';
import { ColorsMenu } from './ColorsMenu';
import { ToolWindow } from '../ToolWindow';
import { collectColors, type ColorInfo, type ColorScope } from './colorsPanelUtils';

export const ColorsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const [scope, setScope] = useState<ColorScope>('current-diagram');

  const groups = collectColors(scope, diagram);

  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);

  const handleColorClick = useCallback(
    (color: ColorInfo) => {
      const elementsToSelect =
        scope === 'current-diagram'
          ? color.elements.filter(el => el.layer.diagram === diagram)
          : color.elements;

      diagram.selection.clear();
      diagram.selection.setElements(elementsToSelect);
      redraw();
    },
    [diagram, scope, redraw]
  );

  return (
    <>
      <ToolWindow.TabActions>
        <ColorsMenu scope={scope} onScopeChange={setScope} />
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <ColorsPanel groups={groups} onColorClick={handleColorClick} />
      </ToolWindow.TabContent>
    </>
  );
};
