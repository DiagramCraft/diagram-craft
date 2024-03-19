import { TbStackBackward } from 'react-icons/tb';
import { ToolbarToggleItemWithPopover } from '../components/ToolbarToggleItemWithPopover.tsx';
import { ShadowPanel } from './ShadowPanel.tsx';
import { useElementProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';

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
