import type { Meta, StoryObj } from '@storybook/react';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Scale, Translation } from '@diagram-craft/geometry/transform';
import {
  applyBooleanOperation,
  classifyClipVertices,
  getClipVertices
} from '@diagram-craft/geometry/pathClip';
import { Path } from '@diagram-craft/geometry/path';
import { TEST_CASES } from '@diagram-craft/geometry/pathClip.testCases';

const BooleanTest = (props: { p1: string; p2: string; p1Offset: number; p2Offset: number }) => {
  const p1 = PathBuilder.fromString(props.p1);
  const p2 = PathBuilder.fromString(props.p2);

  p1.setTransform([new Translation({ x: props.p1Offset, y: props.p1Offset }), new Scale(100, 100)]);
  p2.setTransform([new Translation({ x: props.p2Offset, y: props.p2Offset }), new Scale(100, 100)]);

  const cp1 = p1.getPaths();
  const cp2 = p2.getPaths();

  const [subject, clip] = getClipVertices(cp1, cp2);

  classifyClipVertices([subject, clip], [cp1, cp2], [false, false]);

  const s1 = cp1.asSvgPath();
  const s2 = cp2.asSvgPath();

  const aUnionB = applyBooleanOperation(cp1, cp2, 'A union B');
  const aNotB = applyBooleanOperation(cp1, cp2, 'A not B');
  const bNotA = applyBooleanOperation(cp1, cp2, 'B not A');
  const aIntersectionB = applyBooleanOperation(cp1, cp2, 'A intersection B');
  const aXorB = applyBooleanOperation(cp1, cp2, 'A xor B');
  const aDivideB = applyBooleanOperation(cp1, cp2, 'A divide B');

  return (
    <svg
      width={600}
      height={600}
      viewBox={'-100 -120 600 620'}
      style={{ border: '1px solid black' }}
    >
      {/* Main shape */}
      <g>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A = blue, B = green
        </text>

        <path d={s1} stroke={'blue'} fill={'rgba(0, 0, 255, 0.25)'} />
        <path d={s2} stroke={'green'} fill={'rgba(0, 255, 0, 0.25)'} />
      </g>

      {/* Clipped path */}
      <g transform={'translate(200, 0)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          Clipped paths A
        </text>

        <path d={s1} stroke={'rgb(220, 220, 220)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(220, 220, 220)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {subject.map((s, idx) => {
          const p = new Path(s.segment.start, s.segment.raw());
          return (
            <path
              key={idx}
              d={p.asSvgPath()}
              stroke={idx % 2 === 0 ? 'red' : 'blue'}
              fill={'none'}
            />
          );
        })}

        {subject.map((s, idx) => (
          <circle
            key={idx}
            cx={s.point.x}
            cy={s.point.y}
            r={2}
            fill={s.intersect ? (s.type === 'in->out' ? 'green' : 'red') : 'gray'}
          />
        ))}

        <circle
          cx={subject[0].point.x}
          cy={subject[0].point.y}
          r={5}
          stroke={'red'}
          fill={'none'}
        />
        <circle
          cx={subject[1].point.x}
          cy={subject[1].point.y}
          r={5}
          stroke={'green'}
          fill={'none'}
        />

        {subject.map((s, idx) => {
          const p = new Path(s.segment.start, s.segment.raw());
          return (
            <path
              key={idx}
              d={p.asSvgPath()}
              stroke={idx % 2 === 0 ? 'green' : 'blue'}
              fill={'none'}
            />
          );
        })}
      </g>

      {/* Clipped path */}
      <g transform={'translate(400, 0)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          Clipped paths B
        </text>

        <path d={s1} stroke={'rgb(220, 220, 220)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(220, 220, 220)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {clip.map((s, idx) => {
          const p = new Path(s.segment.start, s.segment.raw());
          return (
            <path
              key={idx}
              d={p.asSvgPath()}
              stroke={idx % 2 === 0 ? 'red' : 'blue'}
              fill={'none'}
            />
          );
        })}

        {clip.map((s, idx) => (
          <circle
            key={idx}
            cx={s.point.x}
            cy={s.point.y}
            r={2}
            fill={s.intersect ? (s.type === 'in->out' ? 'green' : 'red') : 'gray'}
          />
        ))}

        <circle cx={clip[0].point.x} cy={clip[0].point.y} r={5} stroke={'red'} fill={'none'} />
        <circle cx={clip[1].point.x} cy={clip[1].point.y} r={5} stroke={'green'} fill={'none'} />

        {clip.map((s, idx) => {
          const p = new Path(s.segment.start, s.segment.raw());
          return (
            <path
              key={idx}
              d={p.asSvgPath()}
              stroke={idx % 2 === 0 ? 'green' : 'blue'}
              fill={'none'}
            />
          );
        })}
      </g>

      <g transform={'translate(0, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A union B
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {aUnionB
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {aUnionB
          .flatMap(cp => cp.all())
          .map(p => {
            return p.segments.map((s, sidx) => (
              <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />
            ));
          })}
      </g>

      <g transform={'translate(200, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A not B
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {aNotB
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {aNotB
          .flatMap(cp => cp.all())
          .map(p => {
            return p.segments.map((s, sidx) => (
              <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />
            ));
          })}
      </g>

      <g transform={'translate(400, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          B not A
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {bNotA
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {bNotA
          .flatMap(cp => cp.all())
          .map(p => {
            return p.segments.map((s, sidx) => (
              <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />
            ));
          })}
      </g>

      <g transform={'translate(0, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A intersection B
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {aIntersectionB
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {aIntersectionB
          .flatMap(cp => cp.all())
          .map(p =>
            p.segments.map((s, sidx) => {
              return <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />;
            })
          )}
      </g>

      <g transform={'translate(200, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A XOR B
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {aXorB
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {aXorB
          .flatMap(cp => cp.all())
          .map(p => {
            return p.segments.map((s, sidx) => (
              <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />
            ));
          })}
      </g>

      <g transform={'translate(400, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A divide B
        </text>

        <path d={s1} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />
        <path d={s2} stroke={'rgb(200, 200, 200)'} fill={'rgba(195, 195, 195, 0.25)'} />

        {aDivideB
          .flatMap(cp => cp.all())
          .map((p, idx) => (
            <path key={idx} d={p.asSvgPath()} stroke={'red'} fill={'rgba(255, 0, 0, 0.25)'} />
          ))}

        {aDivideB
          .flatMap(cp => cp.all())
          .map(p => {
            return p.segments.map((s, sidx) => (
              <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2} fill={'black'} />
            ));
          })}
      </g>
    </svg>
  );
};

const meta = {
  title: 'Geometry/Path/boolean',
  component: BooleanTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof BooleanTest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    p1: 'M 0.1865,0.0781 C 0.3899,0.1569,0.6487,-0.0614,0.8521,0.0174 L 1,1 L 0.2604,1 C 0.242,0.7695,-0.2645,0.4693,0.1865,0.0781',
    p1Offset: -0.3,
    p2: 'M 0,0 L 0.7539,0 C 0.801,0.25,1.1308,0.2143,0.9424,1 C 0.7068,0.9601,0.2356,0.8802,0,0.8403 L 0,0',
    p2Offset: -0.6
  }
};

export const OnEdge: Story = {
  args: TEST_CASES.OnEdge
};

export const OnEdge2: Story = {
  args: TEST_CASES.OnEdge2
};

export const NonIntersecting: Story = {
  args: TEST_CASES.NonIntersecting
};
