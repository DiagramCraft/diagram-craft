import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback } from 'react';
import { StylesheetsPanel } from './StylesheetsPanel';
import { ToolWindow } from '../ToolWindow';
import { debounce } from '@diagram-craft/utils/debounce';

export const StylesheetsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const handleStylesheetChange = useCallback(() => {
    redrawDebounce();
  }, [redrawDebounce]);

  useEventListener(diagram.document.styles, 'stylesheetAdded', handleStylesheetChange);
  useEventListener(diagram.document.styles, 'stylesheetUpdated', handleStylesheetChange);
  useEventListener(diagram.document.styles, 'stylesheetRemoved', handleStylesheetChange);

  const nodeStyles = diagram.document.styles.nodeStyles;
  const edgeStyles = diagram.document.styles.edgeStyles;
  const textStyles = diagram.document.styles.textStyles;

  const typeOrder = { node: 1, text: 2, edge: 3 };

  const allStylesheets = [...nodeStyles, ...edgeStyles, ...textStyles].sort((a, b) => {
    const typeCompare = typeOrder[a.type] - typeOrder[b.type];
    if (typeCompare !== 0) return typeCompare;
    return a.name.localeCompare(b.name);
  });

  return (
    <ToolWindow.TabContent>
      <StylesheetsPanel stylesheets={allStylesheets} />
    </ToolWindow.TabContent>
  );
};
