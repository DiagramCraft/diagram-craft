import type { Meta, StoryObj } from '@storybook/react';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import {
  applyBooleanOperation,
  classifyClipVertices,
  getClipVertices
} from '@diagram-craft/geometry/pathClip';
import { Path } from '@diagram-craft/geometry/path';
import { TEST_CASES } from '@diagram-craft/geometry/pathClip.testCases';
import { Box } from '@diagram-craft/geometry/box';

const BooleanTest = (props: { p1: PathBuilder; p2: PathBuilder }) => {
  const p1 = props.p1;
  const p2 = props.p2;

  const bounds = Box.boundingBox([p1.getPaths().bounds(), p2.getPaths().bounds()]);

  //const transform = TransformFactory.fromTo(bounds, { x: -50, y: -50, w: 100, h: 100, r: 0 })
  //p1.setTransform(TransformFactory.fromTo(bounds, { x: -50, y: -50, w: 100, h: 100, r: 0 }));
  //p2.setTransform(TransformFactory.fromTo(bounds, { x: -50, y: -50, w: 100, h: 100, r: 0 }));

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

  console.log(bounds);
  const scale = Math.min(120 / bounds.w, 120 / bounds.h);
  const svgTransform = `scale(${scale}, ${scale}) translate(${-bounds.x}, ${-bounds.y}) `;

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

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path d={s1} stroke={'blue'} fill={'rgba(0, 0, 255, 0.25)'} strokeWidth={1 / scale} />
            <path d={s2} stroke={'green'} fill={'rgba(0, 255, 0, 0.25)'} strokeWidth={1 / scale} />
          </g>
        </g>
      </g>

      {/* Clipped path */}
      <g transform={'translate(200, 0)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          Clipped paths A
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {subject.map((s, idx) => {
              const p = new Path(s.segment.start, s.segment.raw());
              return (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={idx % 2 === 0 ? 'red' : 'blue'}
                  fill={'none'}
                  strokeWidth={1 / scale}
                />
              );
            })}

            {subject.map((s, idx) => (
              <circle
                key={idx}
                cx={s.point.x}
                cy={s.point.y}
                r={2 / scale}
                fill={s.intersect ? (s.type === 'in->out' ? 'green' : 'red') : 'gray'}
              />
            ))}

            <circle
              cx={subject[0].point.x}
              cy={subject[0].point.y}
              r={5 / scale}
              strokeWidth={1 / scale}
              stroke={'red'}
              fill={'none'}
            />
            <circle
              cx={subject[1].point.x}
              cy={subject[1].point.y}
              r={5 / scale}
              stroke={'green'}
              strokeWidth={1 / scale}
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
                  strokeWidth={1 / scale}
                />
              );
            })}
          </g>
        </g>
      </g>

      {/* Clipped path */}
      <g transform={'translate(400, 0)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          Clipped paths B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {clip.map((s, idx) => {
              const p = new Path(s.segment.start, s.segment.raw());
              return (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={idx % 2 === 0 ? 'red' : 'blue'}
                  fill={'none'}
                  strokeWidth={1 / scale}
                />
              );
            })}

            {clip.map((s, idx) => (
              <circle
                key={idx}
                cx={s.point.x}
                cy={s.point.y}
                r={2 / scale}
                fill={s.intersect ? (s.type === 'in->out' ? 'green' : 'red') : 'gray'}
              />
            ))}

            <circle
              cx={clip[0].point.x}
              cy={clip[0].point.y}
              r={5 / scale}
              stroke={'red'}
              strokeWidth={1 / scale}
              fill={'none'}
            />
            <circle
              cx={clip[1].point.x}
              cy={clip[1].point.y}
              r={5 / scale}
              stroke={'green'}
              strokeWidth={1 / scale}
              fill={'none'}
            />

            {clip.map((s, idx) => {
              const p = new Path(s.segment.start, s.segment.raw());
              return (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={idx % 2 === 0 ? 'green' : 'blue'}
                  fill={'none'}
                  strokeWidth={1 / scale}
                />
              );
            })}
          </g>
        </g>
      </g>

      <g transform={'translate(0, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A union B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {aUnionB
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {aUnionB
              .flatMap(cp => cp.all())
              .map(p => {
                return p.segments.map((s, sidx) => (
                  <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                ));
              })}
          </g>
        </g>
      </g>

      <g transform={'translate(200, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A not B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {aNotB
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {aNotB
              .flatMap(cp => cp.all())
              .map(p => {
                return p.segments.map((s, sidx) => (
                  <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                ));
              })}
          </g>
        </g>
      </g>

      <g transform={'translate(400, 200)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          B not A
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {bNotA
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {bNotA
              .flatMap(cp => cp.all())
              .map(p => {
                return p.segments.map((s, sidx) => (
                  <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                ));
              })}
          </g>
        </g>
      </g>

      <g transform={'translate(0, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A intersection B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {aIntersectionB
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {aIntersectionB
              .flatMap(cp => cp.all())
              .map(p =>
                p.segments.map((s, sidx) => {
                  return (
                    <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                  );
                })
              )}
          </g>
        </g>
      </g>

      <g transform={'translate(200, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A XOR B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {aXorB
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {aXorB
              .flatMap(cp => cp.all())
              .map(p => {
                return p.segments.map((s, sidx) => (
                  <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                ));
              })}
          </g>
        </g>
      </g>

      <g transform={'translate(400, 400)'}>
        <text x={0} y={-80} width={200} textAnchor={'middle'}>
          A divide B
        </text>

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />
            <path
              d={s2}
              stroke={'rgb(200, 200, 200)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {aDivideB
              .flatMap(cp => cp.all())
              .map((p, idx) => (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={'red'}
                  fill={'rgba(255, 0, 0, 0.25)'}
                  strokeWidth={1 / scale}
                />
              ))}

            {aDivideB
              .flatMap(cp => cp.all())
              .map(p => {
                return p.segments.map((s, sidx) => (
                  <circle key={sidx} cx={s.start.x} cy={s.start.y} r={2 / scale} fill={'black'} />
                ));
              })}
          </g>
        </g>
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
    p1: PathBuilder.fromString(
      'M 0.1865,0.0781 C 0.3899,0.1569,0.6487,-0.0614,0.8521,0.0174 L 1,1 L 0.2604,1 C 0.242,0.7695,-0.2645,0.4693,0.1865,0.0781'
    ),
    p2: PathBuilder.fromString(
      'M -0.6,-0.6 L 0.1539,-0.6 C 0.201,-0.35,0.5308,-0.4143,0.3424,0.4 C 0.1068,0.3601,-0.4356,0.2802,-0.6,0.2403 L -0.6,-0.6'
    )
  }
};

export const OnEdge: Story = {
  args: TEST_CASES.OnEdge()
};

export const OnEdge2: Story = {
  args: TEST_CASES.OnEdge2()
};

export const NonIntersecting: Story = {
  args: TEST_CASES.NonIntersecting()
};

export const CircleOverlappingRectangle: Story = {
  args: TEST_CASES.CircleOverlappingRectangle()
};
