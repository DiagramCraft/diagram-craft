import { forwardRef, useCallback } from 'react';
import {
  EditableCanvasComponent,
  Props
} from '@diagram-craft/canvas/canvas/EditableCanvasComponent';
import { Actions } from '@diagram-craft/canvas/keyMap';
import { useCanvasComponent } from './useCanvasComponent';

export const EditableCanvas = forwardRef<SVGSVGElement, Props & Actions>((props, ref) => {
  const diagram = props.diagram;

  const { actionMap, keyMap } = props;
  const factory = useCallback(() => new EditableCanvasComponent(), []);

  const cmpProps = { ...props, diagram, actionMap, keyMap };

  const hostRef = useCanvasComponent(factory, cmpProps, ref);

  return <div ref={hostRef}></div>;
});
