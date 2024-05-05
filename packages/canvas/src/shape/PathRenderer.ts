import { Path } from '@diagram-craft/geometry/path';
import { DiagramElement } from '@diagram-craft/model/diagramElement';

export type StyledPath = {
  path: Path;
  style: Partial<CSSStyleDeclaration>;
};

export type RenderedStyledPath = {
  path: string;
  style: Partial<CSSStyleDeclaration>;
};

export interface PathRenderer {
  render(node: DiagramElement, path: StyledPath): RenderedStyledPath[];
}

export class DefaultPathRenderer implements PathRenderer {
  render(_node: DiagramElement, path: StyledPath): RenderedStyledPath[] {
    return [{ path: path.path.asSvgPath(), style: path.style }];
  }
}
