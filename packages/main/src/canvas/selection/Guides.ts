import { Line } from '../../geometry/line.ts';
import { round } from '@diagram-craft/utils';
import { SelectionState } from '../../model/selectionState.ts';
import { Component } from '../../base-ui/component.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { text, VNode } from '../../base-ui/vdom.ts';
import { newid } from '@diagram-craft/utils';
import { Point } from '../../geometry/point.ts';

const makeDistanceMarker = (p1: Point, p2: Point, lbl: string): VNode[] => {
  const l = Line.of(p1, p2);
  const marker = `distance_marker_${newid()}`;
  return [
    // TODO: We should make this a global marker
    svg.marker(
      {
        id: marker,
        viewBox: '0 0 10 10',
        refX: 10,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: 'auto-start-reverse'
      },
      svg.path({ d: 'M 0 0 L 10 5 L 0 10 z', stroke: 'pink', fill: 'pink' })
    ),
    svg.line({
      'class': 'svg-guide__distance-line',
      'x1': p1.x,
      'y1': p1.y,
      'x2': p2.x,
      'y2': p2.y,
      'marker-end': `url(#${marker})`,
      'marker-start': `url(#${marker})`
    }),
    svg.rect({
      class: 'svg-guide__distance-label-bg',
      x: Line.midpoint(l).x - lbl.length * 5,
      y: Line.midpoint(l).y - 10,
      rx: 5,
      ry: 5,
      width: lbl.length * 10,
      height: 17
    }),
    svg.text(
      {
        x: Line.midpoint(l).x,
        y: Line.midpoint(l).y,
        class: 'svg-guide__distance-label'
      },
      text(lbl)
    )
  ];
};

export class GuidesComponent extends Component<Props> {
  render(props: Props) {
    return svg.g(
      {},
      ...[
        ...props.selection.guides.filter(s => s.matchingMagnet.type !== 'distance'),
        ...props.selection.guides.filter(s => s.matchingMagnet.type === 'distance')
      ].flatMap(g => {
        const l = Line.extend(g.line, 30, 30);
        return [
          svg.line({
            class: `svg-guide__extension svg-guide__color--${g.matchingMagnet.type}`,
            x1: l.from.x,
            y1: l.from.y,
            x2: l.to.x,
            y2: l.to.y
          }),
          svg.line({
            class: `svg-guide__line svg-guide__color--${g.matchingMagnet.type}`,
            x1: g.line.from.x,
            y1: g.line.from.y,
            x2: g.line.to.x,
            y2: g.line.to.y
          }),
          ...(g.matchingMagnet.type === 'size'
            ? g.matchingMagnet.distancePairs.flatMap(dp =>
                makeDistanceMarker(dp.pointA, dp.pointB, round(dp.distance).toString())
              )
            : []),
          ...(g.matchingMagnet.type === 'distance'
            ? g.matchingMagnet.distancePairs.flatMap(dp =>
                makeDistanceMarker(dp.pointA, dp.pointB, round(dp.distance).toString())
              )
            : [])
        ];
      })
    );
  }
}

type Props = {
  selection: SelectionState;
};
