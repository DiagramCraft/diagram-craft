import { Point } from '../geometry/point.ts';
import React from 'react';
import { Diagram } from '../model-viewer/diagram.ts';
import { invariant } from '../utils/assert.ts';

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

    const rotatedPoint = Point.rotateAround(Point.fromEvent(e.nativeEvent), node.bounds.rotation, {
      x: node.bounds.size.w / 2,
      y: node.bounds.size.h / 2
    });

    const diagramCenter = {
      x: node.bounds.pos.x,
      y: node.bounds.pos.y
    };

    return diagram.viewBox.toScreenPoint(Point.add(diagramCenter, rotatedPoint));
  } else {
    return Point.fromEvent(e.nativeEvent);
  }
};
