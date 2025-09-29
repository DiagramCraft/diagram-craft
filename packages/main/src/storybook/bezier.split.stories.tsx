import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { CubicBezier } from '@diagram-craft/geometry/bezier';
import { Point } from '@diagram-craft/geometry/point';

const BezierTest = () => {
  const [drag, setDrag] = useState<{ callback: (e: React.MouseEvent<any>) => void } | undefined>(
    undefined
  );
  const [start, setStart] = useState({ x: 110, y: 150 });
  const [cp1, setCp1] = useState({ x: 25, y: 190 });
  const [cp2, setCp2] = useState({ x: 210, y: 250 });
  const [end, setEnd] = useState({ x: 210, y: 30 });

  const b = new CubicBezier(start, cp1, cp2, end);

  const [b1, b2] = b.split(0.5);

  const points: Point[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    points.push(b.point(t));
  }

  const splitPoints: Point[] = [];
  for (let i = 0; i <= 13; i++) {
    const t = i / 13;
    splitPoints.push(b1.point(t));
  }
  for (let i = 0; i <= 13; i++) {
    const t = i / 13;
    splitPoints.push(b2.point(t));
  }

  return (
    <svg
      width={600}
      height={300}
      onMouseMove={e => {
        if (drag) drag.callback(e);
      }}
      onMouseUp={() => {
        setDrag(undefined);
      }}
      style={{ border: '1px solid black' }}
    >
      {points.map(p => (
        <circle cx={p.x} cy={p.y} r={2} />
      ))}
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

      <g transform={`translate(300, 0)`}>
        {splitPoints.map(p => (
          <circle cx={p.x} cy={p.y} r={2} />
        ))}
        <circle cx={b1.start.x} cy={b1.start.y} r={5} fill={'red'} />
        <line x1={b1.start.x} y1={b1.start.y} x2={b1.cp1.x} y2={b1.cp1.y} stroke={'red'} />
        <circle cx={b1.cp1.x} cy={b1.cp1.y} r={5} fill={'red'} />
        <line x1={b1.cp1.x} y1={b1.cp1.y} x2={b1.cp2.x} y2={b1.cp2.y} stroke={'red'} />
        <circle cx={b1.cp2.x} cy={b1.cp2.y} r={5} fill={'red'} />
        <line x1={b1.cp2.x} y1={b1.cp2.y} x2={b1.end.x} y2={b1.end.y} stroke={'red'} />
        <circle cx={b1.end.x} cy={b1.end.y} r={5} fill={'red'} />

        <circle cx={b2.start.x} cy={b2.start.y} r={5} fill={'blue'} />
        <line x1={b2.start.x} y1={b2.start.y} x2={b2.cp1.x} y2={b2.cp1.y} stroke={'blue'} />
        <circle cx={b2.cp1.x} cy={b2.cp1.y} r={5} fill={'blue'} />
        <line x1={b2.cp1.x} y1={b2.cp1.y} x2={b2.cp2.x} y2={b2.cp2.y} stroke={'blue'} />
        <circle cx={b2.cp2.x} cy={b2.cp2.y} r={5} fill={'blue'} />
        <line x1={b2.cp2.x} y1={b2.cp2.y} x2={b2.end.x} y2={b2.end.y} stroke={'blue'} />
        <circle cx={b2.end.x} cy={b2.end.y} r={5} fill={'blue'} />
      </g>
    </svg>
  );
};

const meta = {
  title: 'Geometry/Bezier/split',
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
