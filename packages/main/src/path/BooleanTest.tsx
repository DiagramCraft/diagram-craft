import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Box } from '@diagram-craft/geometry/box';
import {
  applyBooleanOperation,
  classifyClipVertices,
  getClipVertices
} from '@diagram-craft/geometry/pathClip';
import { Point } from '@diagram-craft/geometry/point';
import { Path } from '@diagram-craft/geometry/path';
import { PathList } from '@diagram-craft/geometry/pathList';
import { constructPathTree } from '@diagram-craft/geometry/pathUtils';

export const BooleanTest = (props: {
  p1: PathListBuilder | PathList;
  p2: PathListBuilder | PathList;
  hideText?: boolean;
}) => {
  const p1 = props.p1 instanceof PathList ? props.p1 : props.p1.getPaths();
  const p2 = props.p2 instanceof PathList ? props.p2 : props.p2.getPaths();

  const bounds = Box.boundingBox([p1.bounds(), p2.bounds()]);

  const cp1 = p1;
  const cp2 = p2;

  const subjectTree = constructPathTree(cp1.all());
  const clipTree = constructPathTree(cp2.all());
  const [subject, clip] = getClipVertices(cp1, cp2, subjectTree, clipTree);

  classifyClipVertices([subject, clip], [cp1, cp2]);

  const s1 = cp1.asSvgPath();
  const s2 = cp2.asSvgPath();

  const aUnionB = applyBooleanOperation(cp1, cp2, 'A union B');
  const aNotB = applyBooleanOperation(cp1, cp2, 'A not B');
  const bNotA = applyBooleanOperation(cp1, cp2, 'B not A');
  const aIntersectionB = applyBooleanOperation(cp1, cp2, 'A intersection B');
  const aXorB = applyBooleanOperation(cp1, cp2, 'A xor B');
  const aDivideB = applyBooleanOperation(cp1, cp2, 'A divide B');

  const scale = Math.min(120 / bounds.w, 120 / bounds.h);
  const svgTransform = `scale(${scale}, ${scale}) translate(${-bounds.x}, ${-bounds.y}) `;

  const classifyPath = (p: PathList, _debug = false) => {
    const verticesSharedWithSubject = new Set(
      p
        .all()
        .flatMap(seg => seg.segments)
        .flatMap(p => [p.start])
        .filter(v => cp1.isInside(v) || cp1.isOn(v, 1))
        .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
    );
    const verticesSharedWithClip = new Set(
      p
        .all()
        .flatMap(seg => seg.segments)
        .flatMap(p => [p.start])
        .filter(v => cp2.isInside(v) || cp2.isOn(v, 1))
        .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
    );

    const onlySubject = verticesSharedWithSubject.difference(verticesSharedWithClip);
    const onlyClip = verticesSharedWithClip.difference(verticesSharedWithSubject);

    if (verticesSharedWithSubject.size === 0 && verticesSharedWithClip.size === 0) {
      return 'both';
    } else if (verticesSharedWithSubject.size === 0) {
      return 'clip';
    } else if (verticesSharedWithClip.size === 0) {
      return 'subject';
    } else if (onlySubject.size === 0 && onlyClip.size === 0) {
      return 'both';
    } else if (onlySubject.size === 0) {
      return 'clip';
    } else if (onlyClip.size === 0) {
      return 'subject';
    } else {
      return 'both';
    }

    const sharedWithSubject = p
      .all()
      .every(seg =>
        seg.segments.every(
          s =>
            subject
              .flatMap(e => e.vertices)
              .some(v => Point.isEqual(v.point, s.start) || Point.isEqual(v.point, s.end)) ||
            cp1.isInside(s.start)
        )
      );
    const sharesWithClip = p
      .all()
      .every(seg =>
        seg.segments.every(
          s =>
            clip
              .flatMap(e => e.vertices)
              .some(v => Point.isEqual(v.point, s.start) || Point.isEqual(v.point, s.end)) ||
            cp2.isInside(s.start)
        )
      );

    if (sharedWithSubject && sharesWithClip) {
      return 'both';
    } else if (sharedWithSubject) {
      return 'subject';
    } else if (sharesWithClip) {
      return 'clip';
    } else {
      return 'both';
    }
  };

  return (
    <svg
      width={600}
      height={600}
      viewBox={'-100 -120 600 620'}
      style={{ border: '1px solid black' }}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" />
        </marker>
      </defs>

      {/* Main shape */}
      <g>
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A = blue, B = green
          </text>
        )}

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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            Clipped paths A
          </text>
        )}

        <rect x={-70} y={-70} width={140} height={140} fill={'rgba(0, 0, 0, 0.025)'} />
        <g transform={'translate(-60, -60)'}>
          <g transform={svgTransform}>
            <path
              d={s1}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
              markerStart={'url(#arrow)'}
            />
            <path
              d={s2}
              stroke={'rgb(220, 220, 220)'}
              fill={'rgba(195, 195, 195, 0.25)'}
              strokeWidth={1 / scale}
            />

            {subject
              .flatMap(e => e.vertices)
              .map((s, idx) => {
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

            {subject
              .flatMap(e => e.vertices)
              .map((s, idx) => (
                <circle
                  key={idx}
                  cx={s.point.x}
                  cy={s.point.y}
                  r={2 / scale}
                  fill={
                    s.type === 'crossing' ? (s.classification === 'exit' ? 'green' : 'red') : 'gray'
                  }
                />
              ))}

            {subject
              .flatMap(e => e.vertices)
              .map((s, idx) => {
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            Clipped paths B
          </text>
        )}

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
              markerStart={'url(#arrow)'}
            />

            {clip
              .flatMap(e => e.vertices)
              .map((s, idx) => {
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

            {clip
              .flatMap(e => e.vertices)
              .map((s, idx) => (
                <circle
                  key={idx}
                  cx={s.point.x}
                  cy={s.point.y}
                  r={2 / scale}
                  fill={
                    s.type === 'crossing' ? (s.classification === 'exit' ? 'green' : 'red') : 'gray'
                  }
                />
              ))}

            {clip
              .flatMap(e => e.vertices)
              .map((s, idx) => {
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A union B
          </text>
        )}

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

            {aUnionB.map((p, idx) => (
              <path
                key={idx}
                d={p.asSvgPath()}
                stroke={'red'}
                fill={'rgba(255, 0, 0, 0.25)'}
                strokeWidth={1 / scale}
                markerStart={'url(#arrow)'}
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A not B
          </text>
        )}

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

            {aNotB.map((p, idx) => (
              <path
                key={idx}
                d={p.asSvgPath()}
                stroke={'blue'}
                fill={'rgba(0, 0, 255, 0.25)'}
                strokeWidth={1 / scale}
                markerStart={'url(#arrow)'}
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            B not A
          </text>
        )}

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

            {bNotA.map((p, idx) => (
              <path
                key={idx}
                d={p.asSvgPath()}
                stroke={'green'}
                fill={'rgba(0, 255, 0, 0.25)'}
                strokeWidth={1 / scale}
                markerStart={'url(#arrow)'}
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A intersection B
          </text>
        )}

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

            {aIntersectionB.map((p, idx) => (
              <path
                key={idx}
                d={p.asSvgPath()}
                stroke={'red'}
                fill={'rgba(255, 0, 0, 0.25)'}
                strokeWidth={1 / scale}
                markerStart={'url(#arrow)'}
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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A XOR B
          </text>
        )}

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

            {aXorB.map((p, idx) => {
              const k = classifyPath(p, true);
              return (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={k === 'subject' ? 'blue' : k === 'clip' ? 'green' : 'red'}
                  fill={
                    k === 'subject'
                      ? 'rgba(0, 0, 255, 0.25)'
                      : k === 'clip'
                        ? 'rgba(0, 255, 0, 0.25)'
                        : 'rgba(255, 0, 0, 0.25)'
                  }
                  strokeWidth={1 / scale}
                  markerStart={'url(#arrow)'}
                />
              );
            })}

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
        {!props.hideText && (
          <text x={0} y={-80} width={200} textAnchor={'middle'}>
            A divide B
          </text>
        )}

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

            {aDivideB.map((p, idx) => {
              const k = classifyPath(p);
              return (
                <path
                  key={idx}
                  d={p.asSvgPath()}
                  stroke={k === 'subject' ? 'blue' : k === 'clip' ? 'green' : 'red'}
                  fill={
                    k === 'subject'
                      ? 'rgba(0, 0, 255, 0.25)'
                      : k === 'clip'
                        ? 'rgba(0, 255, 0, 0.25)'
                        : 'rgba(255, 0, 0, 0.25)'
                  }
                  strokeWidth={1 / scale}
                  markerStart={'url(#arrow)'}
                />
              );
            })}

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
