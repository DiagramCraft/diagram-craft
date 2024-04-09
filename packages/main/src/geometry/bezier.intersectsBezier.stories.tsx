import type { Meta, StoryObj } from '@storybook/react';
import { CubicBezier } from '@diagram-craft/geometry';
import React, { useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BezierTest = () => {
  const [drag, setDrag] = useState<{ callback: (e: React.MouseEvent<any>) => void } | undefined>(
    undefined
  );
  const [start, setStart] = useState({ x: 50, y: 35 });
  const [cp1, setCp1] = useState({ x: 45, y: 235 });
  const [cp2, setCp2] = useState({ x: 220, y: 235 });
  const [end, setEnd] = useState({ x: 220, y: 135 });

  const [start_2, setStart_2] = useState({ x: 20, y: 150 });
  const [cp1_2, setCp1_2] = useState({ x: 120, y: 20 });
  const [cp2_2, setCp2_2] = useState({ x: 220, y: 95 });
  const [end_2, setEnd_2] = useState({ x: 140, y: 240 });

  const b = new CubicBezier(start, cp1, cp2, end);

  const b_2 = new CubicBezier(start_2, cp1_2, cp2_2, end_2);

  const intersections = b.intersectsBezier(b_2, 0.5);

  return (
    <svg
      width={300}
      height={300}
      onMouseMove={e => {
        if (drag) drag.callback(e);
      }}
      onMouseUp={() => {
        setDrag(undefined);
      }}
      style={{ border: '1px solid black' }}
    >
      <text x={20} y={20}>
        {intersections.length}
      </text>

      <path
        d={`M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`}
        fill={'none'}
        stroke={'gray'}
      />
      <circle
        cx={start.x}
        cy={start.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setStart({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={start.x} y1={start.y} x2={cp1.x} y2={cp1.y} stroke={'red'} />
      <circle
        cx={cp1.x}
        cy={cp1.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setCp1({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={cp1.x} y1={cp1.y} x2={cp2.x} y2={cp2.y} stroke={'red'} />
      <circle
        cx={cp2.x}
        cy={cp2.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setCp2({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={cp2.x} y1={cp2.y} x2={end.x} y2={end.y} stroke={'red'} />
      <circle
        cx={end.x}
        cy={end.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setEnd({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />

      <path
        d={`M ${start_2.x} ${start_2.y} C ${cp1_2.x} ${cp1_2.y}, ${cp2_2.x} ${cp2_2.y}, ${end_2.x} ${end_2.y}`}
        fill={'none'}
        stroke={'gray'}
      />
      <circle
        cx={start_2.x}
        cy={start_2.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setStart_2({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={start_2.x} y1={start_2.y} x2={cp1_2.x} y2={cp1_2.y} stroke={'red'} />
      <circle
        cx={cp1_2.x}
        cy={cp1_2.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setCp1_2({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={cp1_2.x} y1={cp1_2.y} x2={cp2_2.x} y2={cp2_2.y} stroke={'red'} />
      <circle
        cx={cp2_2.x}
        cy={cp2_2.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setCp2_2({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <line x1={cp2_2.x} y1={cp2_2.y} x2={end_2.x} y2={end_2.y} stroke={'red'} />
      <circle
        cx={end_2.x}
        cy={end_2.y}
        r={5}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setEnd_2({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />

      {intersections.map(p => (
        <circle cx={p.x} cy={p.y} r={5} fill={'blue'} />
      ))}
    </svg>
  );
};

const meta = {
  title: 'Geometry/Bezier/intersectsBezier',
  component: BezierTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof BezierTest>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Primary: Story = {
  args: {}
};
