import { TbGrid3X3 } from 'react-icons/tb';
import { CanvasGridPanel } from './CanvasGridPanel';
import { useDiagramProperty } from '../../hooks/useProperty';
import { ToolbarToggleItemWithPopover } from '../../components/ToolbarToggleItemWithPopover';
import { useDiagram } from '../../../application';

export const CanvasGridToolbarButton = () => {
  const diagram = useDiagram();
  const gridEnabled = useDiagramProperty(diagram, 'grid.enabled', true);

  return (
    <ToolbarToggleItemWithPopover
      value={!!gridEnabled.val}
      onChange={gridEnabled.set}
      icon={TbGrid3X3}
    >
      <CanvasGridPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};
