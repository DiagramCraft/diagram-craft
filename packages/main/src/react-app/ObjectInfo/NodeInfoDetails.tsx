import * as Tree from '../components/Tree.tsx';
import { useRedraw } from '../useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramNode } from '@diagram-craft/model';
import { useDiagram } from '../context/DiagramContext.ts';
import { ObjectTreeNode } from '../ObjectTreeNode.tsx';

export const NodeInfoDetails = (props: Props) => {
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
        <Tree.Node>
          <Tree.NodeLabel>nodeType</Tree.NodeLabel>
          <Tree.NodeValue>{props.obj.nodeType}</Tree.NodeValue>
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

type Props = { obj: DiagramNode };
