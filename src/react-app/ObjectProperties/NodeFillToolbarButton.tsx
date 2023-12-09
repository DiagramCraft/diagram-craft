import { TbPaint, TbX } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { NodeFillPanel } from './NodeFillPanel.tsx';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useNodeProperty } from './useProperty.ts';

export const NodeFillToolbarButton = (props: Props) => {
  const fill = useNodeProperty(props.diagram, 'fill.color', 'transparent');

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ReactToolbar.Button className="cmp-toolbar__button">
          <TbPaint />
          <div
            style={{
              marginLeft: '5px',
              width: '30px',
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
          <NodeFillPanel diagram={props.diagram} mode={'panel'} />
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
