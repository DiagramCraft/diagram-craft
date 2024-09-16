import { TbStackBackward } from 'react-icons/tb';
import { useElementProperty } from '../../hooks/useProperty';
import { ToolbarToggleItemWithPopover } from '../../components/ToolbarToggleItemWithPopover';
import { ElementShadowPanel } from './ElementShadowPanel';
import { useDiagram } from '../../../application';

export const ElementShadowToolbarButton = () => {
  const $d = useDiagram();
  const enabled = useElementProperty($d, 'shadow.enabled');

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
