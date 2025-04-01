import { Tree } from '@diagram-craft/app-components/Tree';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { ObjectTreeNode } from './ObjectTreeNode';
import { useDiagram } from '../../../application';
import { Diagram } from '@diagram-craft/model/diagram';

export const DiagramInfoDetails = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
    <Tree.Root>
      <Tree.Node>
        <Tree.NodeLabel>id</Tree.NodeLabel>
        <Tree.NodeCell>{props.obj.id}</Tree.NodeCell>
      </Tree.Node>
      <Tree.Node isOpen={true}>
        <Tree.NodeLabel>props</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.props} />
        </Tree.Children>
      </Tree.Node>
    </Tree.Root>
  );
};

type Props = { obj: Diagram };
