import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useState } from 'react';
import { StylesPanel } from './StylesPanel';
import { StylesMenu } from './StylesMenu';
import { ToolWindow } from '../ToolWindow';
import { collectStyles, type StyleCombination, type StyleScope } from './stylesPanelUtils';
import { debounce } from '@diagram-craft/utils/debounce';

export const StylesTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const [scope, setScope] = useState<StyleScope>('current-diagram');

  const groups = collectStyles(scope, diagram);

  useEventListener(diagram, 'elementChange', redrawDebounce);
  useEventListener(diagram, 'elementAdd', redrawDebounce);
  useEventListener(diagram, 'elementRemove', redrawDebounce);
  useEventListener(diagram, 'diagramChange', redrawDebounce);
  useEventListener(diagram.document, 'diagramChanged', redrawDebounce);

  const handleStyleClick = useCallback(
    (combo: StyleCombination) => {
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
        <StylesMenu scope={scope} onScopeChange={setScope} />
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <StylesPanel groups={groups} onStyleClick={handleStyleClick} />
      </ToolWindow.TabContent>
    </>
  );
};
