import { TbMagnet } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { useSnapManagerProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.ts';

export const CanvasSnapToolbarButton = () => {
  const diagram = useDiagram();
  const enabled = useSnapManagerProperty(diagram, 'enabled', true);

  return (
    <ToolbarToggleItemWithPopover value={!!enabled.val} onChange={enabled.set} icon={TbMagnet}>
      <CanvasSnapPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};
