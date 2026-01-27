import { _p } from '@diagram-craft/geometry/point';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { PathList } from '@diagram-craft/geometry/pathList';
import { stringHash } from '@diagram-craft/utils/hash';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { safeSplit } from '@diagram-craft/utils/safe';

export const RECTANGULAR_SHAPE_ANCHORS: Anchor[] = [
  { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
  { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
  { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
  { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
  { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
];

export const roundedRectOutline = (bounds: Box, radius: number) => {
  const xr = radius / bounds.w;
  const yr = radius / bounds.h;

  return new PathListBuilder()
    .withTransform(fromUnitLCS(bounds))
    .moveTo(_p(xr, 0))
    .lineTo(_p(1 - xr, 0))
    .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
    .lineTo(_p(1, 1 - yr))
    .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
    .lineTo(_p(xr, 1))
    .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
    .lineTo(_p(0, yr))
    .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
};

export const renderIcon = (
  icon: Icon,
  position: Box,
  nodeProps: NodePropsForRendering,
  shapeBuilder: ShapeBuilder
) => {
  shapeBuilder.path(
    PathListBuilder.fromPathList(icon.pathList)
      .getPaths(TransformFactory.fromTo(icon.viewbox, position))
      .all(),
    undefined,
    {
      style: {
        fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
        stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none',
        strokeWidth: '1',
        strokeDasharray: 'none'
      }
    }
  );
};

export type Icon = {
  viewbox: Box;
  pathList: PathList;
  fill?: string;
};

const iconCache = new Map<number, Icon>();

export const getSVGIcon = (s: string) => {
  const key = stringHash(s);
  if (iconCache.has(key)) return iconCache.get(key)!;

  const parser = new DOMParser();
  const $doc = parser.parseFromString(s, 'application/xml');
  const $root = $doc.documentElement;

  const paths: string[] = [];
  const $$children = $root.childNodes;
  for (let i = 0; i < $$children.length; i++) {
    const $child = $$children[i];
    if (!($child instanceof SVGElement)) continue;

    if ($child.tagName === 'path') {
      paths.push($child.getAttribute('d') ?? '');
    } else {
      VERIFY_NOT_REACHED('Only path elements supported');
    }
  }

  const [x, y, w, h] = safeSplit($root.getAttribute('viewBox') ?? '0 0 10 10', ' ', 4, 4);
  const icon = {
    viewbox: { x: parseInt(x), y: parseInt(y), w: parseInt(w), h: parseInt(h), r: 0 },
    pathList: PathListBuilder.fromString(paths.join(' ')).getPaths(),
    fill: $root.getAttribute('fill') ?? undefined
  };
  iconCache.set(key, icon);
  return icon;
};
