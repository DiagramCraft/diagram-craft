import { Tree } from '@diagram-craft/app-components/Tree';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDiagram } from '../../context/DiagramContext';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ObjectTreeNode } from './ObjectTreeNode';

export const NodeInfoDetails = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
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
        <Tree.NodeLabel>text</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.texts} />
        </Tree.Children>
      </Tree.Node>
      <Tree.Node isOpen={true}>
        <Tree.NodeLabel>metadata</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.metadata} />
        </Tree.Children>
      </Tree.Node>
      <Tree.Node isOpen={true}>
        <Tree.NodeLabel>props</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.storedProps} />
        </Tree.Children>
      </Tree.Node>
    </Tree.Root>
  );
};

type Props = { obj: DiagramNode };
