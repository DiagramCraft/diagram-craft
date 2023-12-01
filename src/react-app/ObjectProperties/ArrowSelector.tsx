import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { ARROW_SHAPES, ArrowShape } from '../../base-ui/arrowShapes.ts';

const ArrowPreview = (props: { type: string; arrow?: ArrowShape }) => (
  <svg width={50} height={10}>
    {props.arrow && (
      <marker
        id={`arrow_${props.type}`}
        viewBox={`-1 -1 ${props.arrow.width + 2} ${props.arrow.height + 2}`}
        refX={props.arrow.anchor.x}
        refY={props.arrow.anchor.y}
        markerWidth={props.arrow.width + 2}
        markerHeight={props.arrow.height + 2}
        orient="auto-start-reverse"
      >
        <path
          d={props.arrow.path}
          stroke="var(--secondary-fg)"
          strokeWidth={1}
          fill={
            props.arrow.fill === 'fg'
              ? 'var(--secondary-fg)'
              : props.arrow.fill === 'bg'
              ? 'white'
              : 'none'
          }
        />
      </marker>
    )}
    <path
      d={`M 0 5 L ${49 - (props.arrow?.shortenBy ?? 0)} 5`}
      stroke={'var(--secondary-fg)'}
      strokeWidth={'1'}
      style={{ cursor: 'move', fill: 'none' }}
      markerEnd={props.arrow ? `url(#arrow_${props.type})` : undefined}
    />
  </svg>
);

const PREVIEW_SCALE = 0.75;

export const ArrowSelector = (props: Props) => {
  return (
    <Select.Root value={props.value} onValueChange={props.onValueChange}>
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value
          placeholder={
            <ArrowPreview
              type={props.value ?? 'NONE'}
              arrow={ARROW_SHAPES[props.value ?? 'NONE']?.(PREVIEW_SCALE)}
            />
          }
        />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              {Object.keys(ARROW_SHAPES).map(type => {
                const arrow = ARROW_SHAPES[type](PREVIEW_SCALE);
                return (
                  <Select.Item className={'cmp-select-content__item'} value={type}>
                    <Select.ItemText>
                      <ArrowPreview type={type} arrow={arrow} />
                    </Select.ItemText>
                    <Select.ItemIndicator className="cmp-select-content__item-indicator">
                      <TbCheck />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

interface Props {
  value?: string;
  onValueChange: (value: string | undefined) => void;
}
