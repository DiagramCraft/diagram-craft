import { Diagram } from '../model/diagram.ts';
import { Canvas } from '../react-canvas-editor/Canvas.tsx';

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
