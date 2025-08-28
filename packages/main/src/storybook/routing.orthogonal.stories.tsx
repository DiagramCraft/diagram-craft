import type { Meta, StoryObj } from '@storybook/react';
import { TestModel } from '@diagram-craft/model/test-support/builder';
import { PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { _p, Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { _test, type EdgeType } from '@diagram-craft/model/edgePathBuilder.orthogonal';
import { Box } from '@diagram-craft/geometry/box';
import React, { useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const OrthogonalRoutingTest = (props: { start: any; end: any; numberOfWayPoints: number }) => {
  const [drag, setDrag] = useState<{ callback: (e: React.MouseEvent<any>) => void } | undefined>(
    undefined
  );

  const [node1Bounds, setNode1Bounds] = useState({ x: 100, y: 100, w: 100, h: 50, r: 0 });
  const [node2Bounds, setNode2Bounds] = useState({ x: 160, y: 400, w: 60, h: 80, r: 0 });

  const colors: Record<EdgeType, string> = {
    'midpoint': 'black',
    'waypoint-mid': 'black',
    'waypoint': 'green',
    'start-end': 'green',
    'bounds': 'red',
    'outer-bounds': 'red'
  };

  const diagram = TestModel.newDiagram();
  const layer = diagram.newLayer();
  const node1 = layer.addNode({ bounds: node1Bounds });
  const node2 = layer.addNode({ bounds: node2Bounds });
  const edge = layer.addEdge();
  edge.setStart(
    new PointInNodeEndpoint(node1, _p(0.5, 0.5), _p(0, 0), 'absolute'),
    UnitOfWork.immediate(diagram)
  );
  edge.setEnd(
    new PointInNodeEndpoint(node2, _p(0.5, 0.5), _p(0, 0), 'absolute'),
    UnitOfWork.immediate(diagram)
  );
  if (props.numberOfWayPoints > 0)
    edge.addWaypoint({ point: _p(150, 300) }, UnitOfWork.immediate(diagram));
  if (props.numberOfWayPoints > 1)
    edge.addWaypoint({ point: _p(550, 200) }, UnitOfWork.immediate(diagram));

  const graph = new _test.PathfindingSegmentProvider(edge).constructGraph(
    Box.center(node1.bounds),
    Box.center(node2.bounds)
  );

  const path = _test.buildOrthogonalEdgePath(
    edge,
    props.start !== 'none' ? props.start : undefined,
    props.end !== 'none' ? props.end : undefined,
    true,
    true
  );

  return (
    <svg
      width={600}
      height={600}
      style={{ border: '1px solid black' }}
      onMouseMove={e => {
        if (drag) drag.callback(e);
      }}
      onMouseUp={() => {
        setDrag(undefined);
      }}
    >
      <rect
        x={node1.bounds.x}
        y={node1.bounds.y}
        width={node1.bounds.w}
        height={node1.bounds.h}
        fill={'red'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setNode1Bounds({ ...node1Bounds, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />
      <rect
        x={node2.bounds.x}
        y={node2.bounds.y}
        width={node2.bounds.w}
        height={node2.bounds.h}
        fill={'blue'}
        onMouseDown={() =>
          setDrag({
            callback: (e: React.MouseEvent<SVGCircleElement>) =>
              setNode2Bounds({ ...node2Bounds, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
          })
        }
      />

      {edge.waypoints.map((w, i) => (
        <circle cx={w.point.x} cy={w.point.y} r={5} fill={'green'} key={i} />
      ))}

      {[...graph.edges()].map(e => {
        const s = graph.getVertex(e.from)!;
        const t = graph.getVertex(e.to)!;

        if (!s || !t) console.log(e);

        return (
          <line
            key={e.id}
            x1={s.data.x}
            y1={s.data.y}
            x2={t.data.x}
            y2={t.data.y}
            stroke={colors[e.data[1] as EdgeType]}
          />
        );
      })}

      {[...graph.vertices()].map(v => {
        return (
          <circle key={Point.toString(v.data)} cx={v.data.x} cy={v.data.y} r={2} fill={'green'} />
        );
      })}

      {path && <path d={path!.asSvgPath()} stroke={'black'} strokeWidth={3} fill={'none'} />}
    </svg>
  );
};

const meta = {
  title: 'Geometry/Routing/orthogonal',
  component: OrthogonalRoutingTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    start: {
      options: ['none', 'n', 's', 'w', 'e'],
      control: { type: 'select' }
    },
    end: {
      options: ['none', 'n', 's', 'w', 'e'],
      control: { type: 'select' }
    },
    numberOfWayPoints: {
      options: [0, 1, 2],
      control: { type: 'select' }
    }
  }
} satisfies Meta<typeof OrthogonalRoutingTest>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Primary: Story = {
  args: {
    start: 'none',
    end: 'none',
    numberOfWayPoints: 0
  }
};
