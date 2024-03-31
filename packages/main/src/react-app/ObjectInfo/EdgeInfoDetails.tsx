import * as Tree from '../components/Tree.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { useDiagram } from '../context/DiagramContext.ts';
import { ObjectTreeNode } from '../ObjectTreeNode.tsx';

export const EdgeInfoDetails = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
    <div style={{ margin: '-10px' }}>
      <Tree.Root>
        <Tree.Node>
          <Tree.NodeLabel>id</Tree.NodeLabel>
          <Tree.NodeValue>{props.obj.id}</Tree.NodeValue>
        </Tree.Node>
        <Tree.Node isOpen={true}>
          <Tree.NodeLabel>startPosition</Tree.NodeLabel>
          <Tree.Children>
            <ObjectTreeNode obj={props.obj.start.position} />
          </Tree.Children>
        </Tree.Node>
        <Tree.Node isOpen={true}>
          <Tree.NodeLabel>endPosition</Tree.NodeLabel>
          <Tree.Children>
            <ObjectTreeNode obj={props.obj.end.position} />
          </Tree.Children>
        </Tree.Node>
        <Tree.Node isOpen={true}>
          <Tree.NodeLabel>bounds</Tree.NodeLabel>
          <Tree.Children>
            <ObjectTreeNode obj={props.obj.bounds} />
          </Tree.Children>
        </Tree.Node>
        <Tree.Node isOpen={true}>
          <Tree.NodeLabel>props</Tree.NodeLabel>
          <Tree.Children>
            <ObjectTreeNode obj={props.obj.props} />
          </Tree.Children>
        </Tree.Node>
      </Tree.Root>
    </div>
  );
};

type Props = { obj: DiagramEdge };
