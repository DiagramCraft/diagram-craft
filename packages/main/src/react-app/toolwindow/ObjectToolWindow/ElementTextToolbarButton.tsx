import { TbTextSize } from 'react-icons/tb';
import { useNodeProperty } from '../../hooks/useProperty';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ElementTextPanel } from './ElementTextPanel';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { Popover } from '@diagram-craft/app-components/Popover';

export const ElementTextToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();
  const color = useNodeProperty(diagram, 'text.color', defaults.text.color);

  return (
    <Popover.Root>
      <Popover.Trigger>
        <ReactToolbar.Button className="cmp-toolbar__button">
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
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Content sideOffset={5}>
        <ElementTextPanel mode={'panel'} />
      </Popover.Content>
    </Popover.Root>
  );
};
