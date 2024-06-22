import { TbStackBackward } from 'react-icons/tb';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { useElementProperty } from '../../hooks/useProperty';
import { ToolbarToggleItemWithPopover } from '../../components/ToolbarToggleItemWithPopover';
import { ElementShadowPanel } from './ElementShadowPanel';

export const ElementShadowToolbarButton = () => {
  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const enabled = useElementProperty($d, 'shadow.enabled', defaults.shadow.enabled);

  return (
    <ToolbarToggleItemWithPopover
      value={!!enabled.val}
      onChange={enabled.set}
      icon={TbStackBackward}
    >
      <ElementShadowPanel mode={'panel'} />
    </ToolbarToggleItemWithPopover>
  );
};
