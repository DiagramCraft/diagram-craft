import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback } from 'react';
import { FontsPanel } from './FontsPanel';
import { ToolWindow } from '../ToolWindow';
import { collectFonts, type FontCombination } from './fontsPanelUtils';
import { isNode } from '@diagram-craft/model/diagramElement';

export const FontsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  // Get selected nodes if any
  const selectedNodes = diagram.selection.elements.filter(isNode);

  const groups = collectFonts(diagram, selectedNodes.length > 0 ? [...selectedNodes] : undefined);

  useEventListener(diagram, 'elementChange', redraw);
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);
  useEventListener(diagram.selection, 'change', redraw);

  const handleFontClick = useCallback(
    (combo: FontCombination) => {
      diagram.selection.clear();
      diagram.selection.setElements(combo.elements);
      redraw();
    },
    [diagram, redraw]
  );

  return (
    <>
      <ToolWindow.TabContent>
        <FontsPanel groups={groups} onFontClick={handleFontClick} />
      </ToolWindow.TabContent>
    </>
  );
};
