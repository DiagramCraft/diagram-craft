import { useDiagram } from '../../context/DiagramContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';

export const CanvasGuidesPropertiesPanel = () => {
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
