import { Component, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { text, VNode } from '../component/vdom';
import { Point } from '@diagram-craft/geometry/point';
import { Line } from '@diagram-craft/geometry/line';
import { newid } from '@diagram-craft/utils/id';
import { round } from '@diagram-craft/utils/math';
import { Zoom } from './zoom';
import { Diagram } from '@diagram-craft/model/diagram';
import { SnapMarkers } from '../snap/snapManager';

const makeDistanceMarker = (p1: Point, p2: Point, lbl: string, z: Zoom): VNode[] => {
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
      svg.path({ d: 'M 0 0 L 10 5 L 0 10 z', stroke: 'var(--accent-7)', fill: 'var(--accent-7)' })
    ),
    svg.line({
      'class': 'svg-highlight svg-highlight__distance-line',
      'x1': p1.x,
      'y1': p1.y,
      'x2': p2.x,
      'y2': p2.y,
      'marker-end': `url(#${marker})`,
      'marker-start': `url(#${marker})`
    }),
    svg.rect({
      class: 'svg-highlight svg-highlight__distance-label-bg',
      x: Line.midpoint(l).x - z.num(lbl.length * 5),
      y: Line.midpoint(l).y - z.num(10),
      rx: z.num(5),
      ry: z.num(5),
      width: z.num(lbl.length * 10),
      height: z.num(17)
    }),
    svg.text(
      {
        x: Line.midpoint(l).x,
        y: Line.midpoint(l).y,
        class: 'svg-highlight svg-highlight__distance-label'
      },
      text(lbl)
    )
  ];
};

export class SnapMarkersComponent extends Component<Props> {
  render(props: Props) {
    const mgr = SnapMarkers.get(props.diagram);

    onEvent(mgr, 'clear', () => this.redraw());

    const z = new Zoom(props.diagram.viewBox.zoomLevel);
    return svg.g(
      {},
      ...[
        ...mgr.markers.filter(s => s.matchingMagnet.type !== 'distance'),
        ...mgr.markers.filter(s => s.matchingMagnet.type === 'distance')
      ].flatMap(g => {
        const l = Line.extend(g.line, 30, 30);
        return [
          svg.line({
            class: `svg-highlight svg-highlight__extension svg-highlight__color--${g.matchingMagnet.type}`,
            x1: l.from.x,
            y1: l.from.y,
            x2: l.to.x,
            y2: l.to.y
          }),
          svg.line({
            class: `svg-highlight svg-highlight__line svg-highlight__color--${g.matchingMagnet.type}`,
            x1: g.line.from.x,
            y1: g.line.from.y,
            x2: g.line.to.x,
            y2: g.line.to.y
          }),
          ...(g.matchingMagnet.type === 'size'
            ? g.matchingMagnet.distancePairs.flatMap(dp =>
                makeDistanceMarker(dp.pointA, dp.pointB, round(dp.distance).toString(), z)
              )
            : []),
          ...(g.matchingMagnet.type === 'distance'
            ? g.matchingMagnet.distancePairs.flatMap(dp =>
                makeDistanceMarker(dp.pointA, dp.pointB, round(dp.distance).toString(), z)
              )
            : [])
        ];
      })
    );
  }
}

type Props = {
  diagram: Diagram;
};
