import { ObjectTreeNode, Tree, TreeNode } from '../components/Tree.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

export const NodeInfoDetails = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
    <div style={{ margin: '-0.5rem' }}>
      <Tree>
        <TreeNode label={'id'} value={props.obj.id} />
        <TreeNode label={'nodeType'} value={props.obj.nodeType} />
        <TreeNode label={'bounds'} isOpen={true}>
          <ObjectTreeNode obj={props.obj.bounds} />
        </TreeNode>
        <TreeNode label={'props'} isOpen={true}>
          <ObjectTreeNode obj={props.obj.props} />
        </TreeNode>
      </Tree>
    </div>
  );
};

type Props = { obj: DiagramNode };
