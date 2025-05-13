import { DeepRequired } from '@diagram-craft/utils/types';
import { Indicator } from '@diagram-craft/model/diagramProps';
import { Box } from '@diagram-craft/geometry/box';
import { VNode } from '../component/vdom';
import * as svg from '../component/vdom-svg';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';

type IndicatorRenderer = (
  bounds: Box,
  indicator: DeepRequired<Indicator>,
  fillColor: string
) => VNode;

const DiscIndicator = (bounds: Box, indicator: DeepRequired<Indicator>) => {
  return svg.ellipse({
    cx: bounds.w / 2,
    cy: bounds.h / 2,
    rx: bounds.w / 2,
    ry: bounds.h / 2,
    fill: indicator.color
  });
};

const TriangleIndicator = (bounds: Box, indicator: DeepRequired<Indicator>) => {
  return svg.path({
    d: `M 0 0 L ${bounds.w} ${bounds.h / 2} L 0 ${bounds.h} Z`,
    fill: indicator.color
  });
};

const StarIndicator = (bounds: Box, indicator: DeepRequired<Indicator>) => {
  const sides = 5;
  const innerRadius = 0.5;

  const start = -Math.PI / 2;
  const dTheta = (2 * Math.PI) / sides;

  const pathBuilder = new PathListBuilder().withTransform(
    fromUnitLCS({
      ...bounds,
      x: 0,
      y: 0
    })
  );
  pathBuilder.moveTo(Point.of(0.5, 0));

  for (let i = 0; i < sides; i++) {
    const angle = start + (i + 1) * dTheta;

    const iAngle = angle - dTheta / 2;
    pathBuilder.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(iAngle, innerRadius * 0.5)));
    pathBuilder.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(angle, 0.5)));
  }

  return svg.path({
    d: pathBuilder.getPaths().asSvgPath(),
    fill: indicator.color
  });
};

const ActorIndicator = (bounds: Box, indicator: DeepRequired<Indicator>) => {
  const b = new PathListBuilder().withTransform(
    fromUnitLCS({
      ...bounds,
      x: 0,
      y: 0
    })
  );

  b.moveTo(Point.of(0.5, 0));
  b.arcTo(_p(0.75, 0.25), 0.25, 0.25, 0, 0, 1);
  b.arcTo(_p(0.5, 0.5), 0.25, 0.25, 0, 0, 1);
  b.arcTo(_p(0.25, 0.25), 0.25, 0.25, 0, 0, 1);
  b.arcTo(_p(0.5, 0), 0.25, 0.25, 0, 0, 1);

  b.moveTo(Point.of(0, 1));
  b.arcTo(_p(0.5, 0.5), 0.5, 0.5, 0, 0, 1);
  b.arcTo(_p(1, 1), 0.5, 0.5, 0, 0, 1);

  return svg.path({
    d: b.getPaths().asSvgPath(),
    fill: indicator.color
  });
};

const LockIndicator = (bounds: Box, indicator: DeepRequired<Indicator>) => {
  const b = new PathListBuilder().withTransform(
    fromUnitLCS({
      ...bounds,
      x: 0,
      y: 0
    })
  );

  b.moveTo(Point.of(0.2, 0.35));
  b.arcTo(_p(0.5, 0), 0.3, 0.35, 0, 0, 1);
  b.arcTo(_p(0.8, 0.35), 0.3, 0.35, 0, 0, 1);
  b.lineTo(_p(0.7, 0.35));
  b.arcTo(_p(0.5, 0.1), 0.2, 0.25, 0, 0, 0);
  b.arcTo(_p(0.3, 0.35), 0.2, 0.25, 0, 0, 0);
  b.close();

  b.moveTo(_p(0.1, 0.35));
  b.lineTo(_p(0.1, 1));
  b.lineTo(_p(0.9, 1));
  b.lineTo(_p(0.9, 0.35));
  b.close();

  return svg.path({
    d: b.getPaths().asSvgPath(),
    fill: indicator.color
  });
};

const CommentIndicator = (bounds: Box, indicator: DeepRequired<Indicator>, fillColor: string) => {
  const b = new PathListBuilder().withTransform(
    fromUnitLCS({
      ...bounds,
      x: 0,
      y: 0
    })
  );

  b.moveTo(Point.of(0, 0.1));
  b.arcTo(_p(0.1, 0), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(0.9, 0));
  b.arcTo(_p(1, 0.1), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(1, 0.6));
  b.arcTo(_p(0.9, 0.7), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(0.7, 0.7));
  b.lineTo(_p(0.9, 1));
  b.lineTo(_p(0.4, 0.7));
  b.lineTo(_p(0.1, 0.7));
  b.arcTo(_p(0, 0.6), 0.1, 0.1, 0, 0, 1);
  b.close();

  return svg.path({
    d: b.getPaths().asSvgPath(),
    stroke: indicator.color,
    fill: fillColor
  });
};

const NoteIndicator = (bounds: Box, indicator: DeepRequired<Indicator>, fillColor: string) => {
  const b = new PathListBuilder().withTransform(
    fromUnitLCS({
      ...bounds,
      x: 0,
      y: 0
    })
  );

  b.moveTo(Point.of(0, 0));
  b.lineTo(_p(0.8, 0));
  b.lineTo(_p(1, 0.2));
  b.lineTo(_p(1, 1));
  b.lineTo(_p(0, 1));
  b.close();

  b.moveTo(_p(0.3, 0.3));
  b.lineTo(_p(0.7, 0.3));

  b.moveTo(_p(0.3, 0.5));
  b.lineTo(_p(0.7, 0.5));

  b.moveTo(_p(0.3, 0.7));
  b.lineTo(_p(0.7, 0.7));

  return svg.path({
    d: b.getPaths().asSvgPath(),
    stroke: indicator.color,
    fill: fillColor
  });
};

export const INDICATORS: Record<string, IndicatorRenderer> = {
  none: DiscIndicator,
  disc: DiscIndicator,
  triangle: TriangleIndicator,
  star: StarIndicator,
  actor: ActorIndicator,
  lock: LockIndicator,
  comment: CommentIndicator,
  note: NoteIndicator
};
