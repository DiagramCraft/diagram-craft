import { DiagramNode } from '@diagram-craft/model';
import { hash } from '@diagram-craft/utils';
import { Path } from '@diagram-craft/geometry';
import { asDistortedSvgPath, calculateHachureLines } from '../sketch.ts';

export type StyledPath = {
  path: Path;
  style: Partial<CSSStyleDeclaration>;
};

export type RenderedStyledPath = {
  path: string;
  style: Partial<CSSStyleDeclaration>;
};

export interface PathRenderer {
  render(node: DiagramNode, path: StyledPath): RenderedStyledPath[];
}

export class SketchPathRenderer implements PathRenderer {
  render(node: DiagramNode, path: StyledPath): RenderedStyledPath[] {
    const svgPathOutline = asDistortedSvgPath(path.path, hash(new TextEncoder().encode(node.id)), {
      passes: 2,
      amount: node.props.effects?.sketchStrength ?? 0.1
    });
    const svgPathFill = asDistortedSvgPath(path.path, hash(new TextEncoder().encode(node.id)), {
      passes: 1,
      amount: node.props.effects?.sketchStrength ?? 0.1,
      distortVertices: true
    });

    const boundaryStyle = { ...path.style };
    const fillStyle = { ...path.style };

    boundaryStyle.fill = 'none';
    fillStyle.stroke = 'none';

    let hachure: string[] | undefined = undefined;

    if (node.props.effects?.sketchFillType === 'hachure') {
      const lines = calculateHachureLines(node.bounds, path.path, Math.PI / 4, 10);
      hachure = lines.map(l => {
        return asDistortedSvgPath(
          new Path(l.from, [['L', l.to.x, l.to.y]]),
          hash(new TextEncoder().encode(node.id)),
          {
            passes: 2,
            amount: node.props.effects?.sketchStrength ?? 0.1,
            unidirectional: false
          }
        );
      });
    }

    const dest: RenderedStyledPath[] = [];
    if (hachure) {
      hachure.forEach(l => {
        dest.push({ path: l, style: { stroke: fillStyle.fill, strokeWidth: '1', fill: 'none' } });
      });
    } else {
      dest.push({ path: svgPathFill, style: fillStyle });
    }

    dest.push({ path: svgPathOutline, style: boundaryStyle });
    return dest;
  }
}

export class DefaultPathRenderer implements PathRenderer {
  render(_node: DiagramNode, path: StyledPath): RenderedStyledPath[] {
    return [{ path: path.path.asSvgPath(), style: path.style }];
  }
}
