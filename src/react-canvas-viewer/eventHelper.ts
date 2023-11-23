import { Point } from '../geometry/point.ts';
import React from 'react';
import { Diagram } from '../model-viewer/diagram.ts';

export const getPoint = (e: React.MouseEvent<Element, MouseEvent>, diagram: Diagram) => {
  if ((e.nativeEvent.target as HTMLDivElement)?.nodeName === 'DIV') {
    let $el = e.nativeEvent.target as HTMLDivElement;

    while ($el.nodeName !== 'foreignObject') {
      $el = $el.parentNode as HTMLDivElement;
    }

    const $fel = $el as unknown as SVGForeignObjectElement;

    return diagram.viewBox.toScreenPoint(
      Point.add(
        { x: $fel.x.baseVal.value, y: $fel.y.baseVal.value },
        Point.fromEvent(e.nativeEvent)
      )
    );
  } else {
    return Point.fromEvent(e.nativeEvent);
  }
};
