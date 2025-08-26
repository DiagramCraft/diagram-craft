import { TbPlus } from 'react-icons/tb';
import { CanvasGuidesPanel } from './CanvasGuidesPanel';
import { ToolbarToggleItemWithPopover } from '../../components/ToolbarToggleItemWithPopover';
import { useDiagramProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../../application';

export const CanvasGuidesToolbarButton = () => {
  const diagram = useDiagram();
  const guidesEnabled = useDiagramProperty(diagram, 'guides.enabled', true);

  return (
    <ToolbarToggleItemWithPopover
      value={!!guidesEnabled.val}
      onChange={guidesEnabled.set}
      icon={TbPlus}
    >
      <CanvasGuidesPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};