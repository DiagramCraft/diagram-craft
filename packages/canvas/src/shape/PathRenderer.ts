import { DiagramNode } from '@diagram-craft/model';
import { Path } from '@diagram-craft/geometry/path';

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

export class DefaultPathRenderer implements PathRenderer {
  render(_node: DiagramNode, path: StyledPath): RenderedStyledPath[] {
    return [{ path: path.path.asSvgPath(), style: path.style }];
  }
}
