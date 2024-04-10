import { TbStackBackward } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover';
import { ShadowPanel } from './ShadowPanel';
import { useElementProperty } from './useProperty';
import { useDiagram } from '../context/DiagramContext';
import { useNodeDefaults } from '../useDefaults';

export const ShadowToolbarButton = () => {
  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const enabled = useElementProperty($d, 'shadow.enabled', defaults.shadow.enabled);

  return (
    <ToolbarToggleItemWithPopover
      value={!!enabled.val}
      onChange={enabled.set}
      icon={TbStackBackward}
    >
      <ShadowPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};
