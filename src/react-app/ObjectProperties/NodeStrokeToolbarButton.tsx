import { TbBorderStyle2, TbX } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useNodeProperty } from './useProperty.ts';
import { NodeStrokePanel } from './NodeStrokePanel.tsx';

export const NodeStrokeToolbarButton = (props: Props) => {
  const [fill] = useNodeProperty('stroke.color', props.diagram, 'transparent');

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ReactToolbar.Button className="cmp-toolbar__button">
          <TbBorderStyle2 />
          <div
            style={{
              marginLeft: '5px',
              width: '30px',
              height: '12px',
              backgroundColor: fill ?? 'transparent',
              marginRight: '3px',
              border: '1px solid var(--primary-fg)',
              borderRadius: '3px'
            }}
          ></div>
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <NodeStrokePanel diagram={props.diagram} mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
