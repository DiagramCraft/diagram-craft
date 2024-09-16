import { TbTextSize } from 'react-icons/tb';
import { useNodeProperty } from '../../hooks/useProperty';
import { NodeTextPanel } from './NodeTextPanel';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useDiagram } from '../../../application';

export const ElementTextToolbarButton = () => {
  const diagram = useDiagram();
  const color = useNodeProperty(diagram, 'text.color');

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Toolbar.Button>
          <TbTextSize />
          <div
            style={{
              marginLeft: '5px',
              width: '15px',
              height: '12px',
              backgroundColor: color.val,
              marginRight: '3px',
              border: '1px solid var(--primary-fg)',
              borderRadius: '3px'
            }}
          ></div>
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content sideOffset={5}>
        <NodeTextPanel mode={'panel'} />
      </Popover.Content>
    </Popover.Root>
  );
};
