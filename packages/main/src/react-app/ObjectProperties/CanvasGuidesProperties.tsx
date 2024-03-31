import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useDiagram } from '../context/DiagramContext.ts';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';

export const CanvasGuidesProperties = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'change', redraw);

  return (
    <ToolWindowPanel mode={'accordion'} id={'guides'} title={'Guides'} hasCheckbox={true}>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Guides:</div>
        <div className={'cmp-labeled-table__value'}>Not implemented yet</div>
      </div>
    </ToolWindowPanel>
  );
};
