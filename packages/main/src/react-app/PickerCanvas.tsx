import { Diagram } from '@diagram-craft/model';
import { Canvas } from '../canvas-react/Canvas.tsx';

export const PickerCanvas = (props: PickerCanvasProps) => {
  const diagram = props.diagram;

  return (
    <Canvas
      width={props.width ?? 40}
      height={props.height ?? 40}
      onClick={props.onClick}
      diagram={diagram}
    />
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
};
