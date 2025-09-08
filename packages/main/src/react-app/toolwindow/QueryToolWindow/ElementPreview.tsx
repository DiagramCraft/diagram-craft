import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import {
  StaticCanvasComponent,
  StaticCanvasProps
} from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { useApplication } from '../../../application';
import { useMemo } from 'react';

type ElementPreviewProps = {
  element: DiagramElement;
  size?: number;
};

export const ElementPreview = ({ element, size = 24 }: ElementPreviewProps) => {
  const application = useApplication();

  const viewBox = useMemo(() => {
    const bounds = element.bounds;
    const padding = Math.max(bounds.w, bounds.h) * 0.05;

    return `${bounds.x - padding} ${bounds.y - padding} ${bounds.w + 2 * padding} ${bounds.h + 2 * padding}`;
  }, [element]);

  return (
    <Canvas<StaticCanvasComponent, StaticCanvasProps>
      id={`element-preview-${element.id}`}
      context={application}
      width={size}
      height={size}
      diagram={element.diagram}
      viewbox={viewBox}
      canvasFactory={() => new StaticCanvasComponent()}
    />
  );
};
