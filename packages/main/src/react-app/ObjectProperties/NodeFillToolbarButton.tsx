import { TbPaint, TbX } from 'react-icons/tb';
import { NodeFillPanel } from './NodeFillPanel';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useNodeProperty } from './useProperty';
import { useDiagram } from '../context/DiagramContext';
import { useNodeDefaults } from '../useDefaults';

// TODO: Make this disable if selection includes edges
export const NodeFillToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();

  const fill = useNodeProperty(diagram, 'fill.color', defaults.fill.color);

  const disabled = diagram.selectionState.nodes.every(n => !n.getDefinition().supports('fill'));

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ReactToolbar.Button className="cmp-toolbar__button" disabled={disabled}>
          <TbPaint />
          <div
            style={{
              marginLeft: '5px',
              width: '30px',
              height: '12px',
              backgroundColor: disabled ? 'var(--slate-8)' : fill.val,
              marginRight: '3px',
              border: `1px solid ${disabled ? 'var(--slate-8)' : 'var(--primary-fg)'}`,
              borderRadius: '3px'
            }}
          ></div>
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <NodeFillPanel mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
