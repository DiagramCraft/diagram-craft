import { TbTextSize, TbX } from 'react-icons/tb';
import { useNodeProperty } from '../../hooks/useProperty';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ElementTextPanel } from './ElementTextPanel';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';

export const ElementTextToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();
  const color = useNodeProperty(diagram, 'text.color', defaults.text.color);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
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
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <ElementTextPanel mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
