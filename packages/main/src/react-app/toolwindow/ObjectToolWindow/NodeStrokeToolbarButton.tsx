import { TbBorderStyle2 } from 'react-icons/tb';
import { useNodeProperty } from '../../hooks/useProperty';
import { NodeStrokePanel } from './NodeStrokePanel';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useDiagram } from '../../../application';

export const NodeStrokeToolbarButton = () => {
  const diagram = useDiagram();
  const fill = useNodeProperty(diagram, 'stroke.color');

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Toolbar.Button>
          <TbBorderStyle2 />
          <div
            style={{
              marginLeft: '5px',
              width: '15px',
              height: '12px',
              backgroundColor: fill.val,
              marginRight: '3px',
              border: '1px solid var(--primary-fg)',
              borderRadius: '3px'
            }}
          ></div>
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content sideOffset={5}>
        <NodeStrokePanel mode={'panel'} />
      </Popover.Content>
    </Popover.Root>
  );
};
