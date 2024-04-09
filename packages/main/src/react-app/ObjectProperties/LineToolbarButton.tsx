import { TbX } from 'react-icons/tb';
import * as Popover from '@radix-ui/react-popover';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { useEdgeProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.ts';
import { useEdgeDefaults } from '../useDefaults.tsx';
import { LinePanel } from './LinePanel.tsx';
import { ArrowPreview } from './ArrowPreview.tsx';
import { ARROW_SHAPES } from '@diagram-craft/canvas';

export const LineToolbarButton = () => {
  const diagram = useDiagram();
  const defaults = useEdgeDefaults();
  const strokeColor = useEdgeProperty(diagram, 'stroke.color', defaults.stroke.color);
  const fillColor = useEdgeProperty(diagram, 'fill.color', strokeColor.val);
  const arrowStart = useEdgeProperty(diagram, 'arrow.start.type', defaults.arrow.start.type);
  const arrowEnd = useEdgeProperty(diagram, 'arrow.end.type', defaults.arrow.end.type);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ReactToolbar.Button className="cmp-toolbar__button">
          <div
            style={{
              marginLeft: '5px',
              width: '75px',
              height: '12px',
              backgroundColor: 'var(--canvas-bg)',
              marginRight: '3px',
              paddingTop: '2px',
              border: '1px solid var(--tertiary-fg)',
              borderRadius: '3px'
            }}
          >
            <ArrowPreview
              fg={fillColor.val}
              bg={'var(--canvas-bg)'}
              color={strokeColor.val}
              width={65}
              type={arrowStart.val}
              start={ARROW_SHAPES[arrowStart.val]?.(0.75)}
              end={ARROW_SHAPES[arrowEnd.val]?.(0.75)}
            />
          </div>
        </ReactToolbar.Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cmp-popover cmp-popover--toolbar" sideOffset={5}>
          <LinePanel mode={'panel'} />
          <Popover.Close className="cmp-popover__close" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
