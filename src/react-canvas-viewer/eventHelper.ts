import { Point } from '../geometry/point.ts';
import React from 'react';
import { Diagram } from '../model/diagram.ts';
import { invariant } from '../utils/assert.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';

// TODO: We should be able to remove this, and just use something like
//
//           const r = e.currentTarget.getBoundingClientRect();
//           tool.onMouseMove(
//             {
//               x: e.nativeEvent.clientX - r.x,
//               y: e.nativeEvent.clientY - r.y
//             },
//             e.nativeEvent
//           );
export const getPoint = (e: React.MouseEvent<Element, MouseEvent>, diagram: Diagram) => {
  if ((e.nativeEvent.target as HTMLDivElement)?.nodeName === 'DIV') {
    let $el = e.nativeEvent.target as HTMLDivElement;

    while ($el.nodeName !== 'foreignObject') {
      $el = $el.parentNode as HTMLDivElement;
    }

    const $fel = $el as unknown as SVGForeignObjectElement;

    const $gel = $fel.parentElement as unknown as SVGGElement;
    invariant.is.true($gel.nodeName === 'g');

    // TODO: Can we use data attributes for this instead
    const id = $gel.id.substring('node-'.length);
    const node = diagram.nodeLookup[id];

    const rotatedPoint = Point.rotateAround(
      EventHelper.point(e.nativeEvent),
      node.bounds.rotation,
      {
        x: node.bounds.size.w / 2,
        y: node.bounds.size.h / 2
      }
    );

    const diagramCenter = {
      x: node.bounds.pos.x,
      y: node.bounds.pos.y
    };

    return diagram.viewBox.toScreenPoint(Point.add(diagramCenter, rotatedPoint));
  } else {
    return EventHelper.point(e.nativeEvent);
  }
};
