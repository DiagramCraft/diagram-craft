import { TbBorderStyle2 } from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { NodeStrokePanel } from './NodeStrokePanel';
import { Popover } from '@diagram-craft/app-components/Popover';

export const NodeStrokeToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();
  const fill = useNodeProperty(diagram, 'stroke.color', defaults.stroke.color);

  return (
    <Popover.Root>
      <Popover.Trigger>
        <ReactToolbar.Button className="cmp-toolbar__button">
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
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Content sideOffset={5}>
        <NodeStrokePanel mode={'panel'} />
      </Popover.Content>
    </Popover.Root>
  );
};
