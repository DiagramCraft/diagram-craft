import { TbMagnet } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover';
import { CanvasSnapPanel } from './CanvasSnapPanel';
import { useSnapManagerProperty } from './useProperty';
import { useDiagram } from '../context/DiagramContext';

export const CanvasSnapToolbarButton = () => {
  const diagram = useDiagram();
  const enabled = useSnapManagerProperty(diagram, 'enabled', true);

  return (
    <ToolbarToggleItemWithPopover value={!!enabled.val} onChange={enabled.set} icon={TbMagnet}>
      <CanvasSnapPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};
