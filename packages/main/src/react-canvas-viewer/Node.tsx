import { forwardRef, SVGProps, useImperativeHandle } from 'react';
import { Diagram } from '../model/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { Point } from '../geometry/point.ts';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { ApplicationTriggers } from '../react-canvas-editor/EditableCanvas.tsx';
import { Tool } from '../react-canvas-editor/tools/types.ts';
import { BaseShape, BaseShapeProps } from './temp/baseShape.temp.ts';
import { useComponent } from './temp/useComponent.temp.ts';
import { useActions } from '../react-app/context/ActionsContext.ts';

export type NodeApi = {
  repaint: () => void;
};

const SimpleComponent = (props: BaseShapeProps & { component: () => BaseShape }) => {
  const ref = useComponent<BaseShapeProps, BaseShape>(props.component, {
    def: props.def,
    applicationTriggers: props.applicationTriggers,
    diagram: props.diagram,
    tool: props.tool,
    onMouseDown: props.onMouseDown,
    onDoubleClick: props.onDoubleClick,
    mode: props.mode,
    actionMap: props.actionMap
  });

  return <g ref={ref} />;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const $d = props.diagram;
  const redraw = useRedraw();
  const { actionMap } = useActions();

  useImperativeHandle(ref, () => ({ repaint: redraw }));

  const nodeDef = $d.nodeDefinitions.get(props.def.nodeType);

  if ((nodeDef as ReactNodeDefinition).component !== undefined) {
    return (
      <SimpleComponent
        component={(nodeDef as ReactNodeDefinition).component!}
        def={props.def}
        onMouseDown={props.onMouseDown}
        onDoubleClick={props.onDoubleClick}
        applicationTriggers={props.applicationTriggers}
        diagram={props.diagram}
        tool={props.tool}
        mode={props.mode}
        actionMap={actionMap}
      />
    );
  }

  throw new Error('not used');
});

type Props = {
  def: DiagramNode;
  diagram: Diagram;
  tool: Tool | undefined;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick?: (id: string, coord: Point) => void;
  mode?: 'picker' | 'canvas';
  applicationTriggers: ApplicationTriggers;
} & Omit<
  SVGProps<SVGGElement>,
  'id' | 'transform' | 'onMouseMove' | 'onMouseDown' | 'onDoubleClick'
>;
