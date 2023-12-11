import { ObjectTreeNode, Tree, TreeNode } from '../components/Tree.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramEdge } from '../../model-viewer/diagramEdge.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

export const EdgeInfoDetails = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'edgechanged', redraw);
  return (
    <div style={{ margin: '-0.5rem' }}>
      <Tree>
        <TreeNode label={'id'} value={props.obj.id} />
        <TreeNode label={'startPosition'} isOpen={true}>
          <ObjectTreeNode obj={props.obj.startPosition} />
        </TreeNode>
        <TreeNode label={'endPosition'} isOpen={true}>
          <ObjectTreeNode obj={props.obj.endPosition} />
        </TreeNode>
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

type Props = { obj: DiagramEdge };
