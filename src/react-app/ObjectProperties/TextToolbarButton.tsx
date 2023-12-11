import { TbTextSize, TbX } from 'react-icons/tb';
import { useNodeProperty } from './useProperty.ts';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TextPanel } from './TextPanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';

export const TextToolbarButton = () => {
  const diagram = useDiagram();
  const fill = useNodeProperty(diagram, 'text.color', 'transparent');

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
              backgroundColor: fill.val ?? 'transparent',
              marginRight: '3px',
              border: '1px solid var(--primary-fg)',
              borderRadius: '3px'
            }}
          ></div>
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <TextPanel mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
