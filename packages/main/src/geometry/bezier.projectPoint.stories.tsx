import type { Meta, StoryObj } from '@storybook/react';
import { CubicBezier } from '@diagram-craft/geometry/src/bezier.ts';
import { Point } from '@diagram-craft/geometry/src/point.ts';
import React, { useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BezierTest = () => {
  const [drag, setDrag] = useState<{ callback: (e: React.MouseEvent<any>) => void } | undefined>(
    undefined
  );
  const [start, setStart] = useState({ x: 110, y: 150 });
  const [cp1, setCp1] = useState({ x: 25, y: 190 });
  const [cp2, setCp2] = useState({ x: 210, y: 250 });
  const [end, setEnd] = useState({ x: 210, y: 30 });

  const [point, setPoint] = useState({ x: 0, y: 0 });

  const b = new CubicBezier(start, cp1, cp2, end);

  const points: Point[] = [];

  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    points.push(b.point(t));
  }

  const pp = b.projectPoint(point);

  return (
    <svg
      width={600}
      height={300}
      onMouseMove={e => {
        if (drag) drag.callback(e);
        else setPoint({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      }}
      onMouseUp={() => {
        setDrag(undefined);
      }}
      style={{ border: '1px solid black' }}
    >
      {points.map((p, i) => (
        <React.Fragment key={i}>
          <circle cx={p.x} cy={p.y} r={2} />
        </React.Fragment>
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

      <circle cx={point.x} cy={point.y} r={5} fill={'green'} />
      <circle cx={pp.point.x} cy={pp.point.y} r={5} fill={'purple'} />
    </svg>
  );
};

const meta = {
  title: 'Geometry/Bezier/projectPoint',
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
