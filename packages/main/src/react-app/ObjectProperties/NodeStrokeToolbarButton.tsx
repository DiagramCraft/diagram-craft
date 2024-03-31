import { TbBorderStyle2, TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useNodeProperty } from './useProperty.ts';
import { NodeStrokePanel } from './NodeStrokePanel.tsx';
import { useDiagram } from '../context/DiagramContext.ts';
import { useNodeDefaults } from '../useDefaults.tsx';

export const NodeStrokeToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();
  const fill = useNodeProperty(diagram, 'stroke.color', defaults.stroke.color);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
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
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <NodeStrokePanel mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
