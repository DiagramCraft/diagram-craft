import type { Meta, StoryObj } from '@storybook/react-vite';
import { ARROW_SHAPES, type ArrowShape } from '@diagram-craft/canvas/arrowShapes';

const ArrowShapePreview = (props: { name: string; shape: ArrowShape }) => (
  <div style={{ display: 'flex', marginBottom: '0.25rem' }}>
    <svg width={50} height={10} style={{ border: '1px solid lightgray' }}>
      <marker
        id={`arrow_end_${props.name}`}
        viewBox={`-1 -1 ${props.shape.width + 2} ${props.shape.height + 2}`}
        refX={props.shape.anchor.x}
        refY={props.shape.anchor.y}
        markerWidth={props.shape.width + 2}
        markerHeight={props.shape.height + 2}
        orient="auto-start-reverse"
      >
        <path
          d={props.shape.path}
          stroke={'black'}
          strokeWidth={1}
          fill={props.shape.fill === 'fg' ? 'black' : props.shape.fill === 'bg' ? 'white' : 'none'}
        />
      </marker>

      <path
        d={`M ${2} 5 L ${50 - 1 - (props.shape.shortenBy ?? 0)} 5`}
        stroke={'black'}
        strokeWidth={'1'}
        style={{ cursor: 'move', fill: 'none' }}
        markerEnd={`url(#arrow_end_${props.name})`}
      />
    </svg>
    <div style={{ color: 'black', marginLeft: '0.5rem', fontSize: '11px' }}>{props.name}</div>
  </div>
);

const ArrowShapeList = () => {
  const shapes = Object.entries(ARROW_SHAPES).map(
    ([name, shapeFn]) => [name, shapeFn!(0.75, 1)!] as const
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem' }}>
      <div>
        {shapes.slice(0, 19).map(([name, shape]) => (
          <ArrowShapePreview key={name} name={name} shape={shape} />
        ))}
      </div>
      <div>
        {shapes.slice(19).map(([name, shape]) => (
          <ArrowShapePreview key={name} name={name} shape={shape} />
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Shapes/Arrows',
  component: ArrowShapeList,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof ArrowShapeList>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Primary: Story = {
  args: {}
};
