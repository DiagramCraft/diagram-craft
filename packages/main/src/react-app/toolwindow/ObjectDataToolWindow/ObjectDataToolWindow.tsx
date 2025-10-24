import { useDiagram } from '../../../application';
import { ObjectNamePanel } from './ObjectNamePanel';
import { ExtendedDataTab } from './ExtendedDataTab';
import { ToolWindow } from '../ToolWindow';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

export const ObjectDataToolWindow = () => {
  const $d = useDiagram();
  const redraw = useRedraw();

  useEventListener($d.selection, 'change', redraw);
  useEventListener($d, 'diagramChange', redraw);
  useEventListener($d, 'elementBatchChange', redraw);

  return (
    <ToolWindow.Root id={'object-data'} defaultTab={'name'}>
      <ToolWindow.Tab id={'name'} title={'Basic Info'}>
        <ToolWindow.TabContent>
          {$d.selection.elements.length === 1 && <ObjectNamePanel mode="headless" />}
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'data'} title={'Extended Data'}>
        <ExtendedDataTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
