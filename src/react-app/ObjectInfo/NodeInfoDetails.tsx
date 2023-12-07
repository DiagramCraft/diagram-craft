import { ObjectTreeNode, Tree, TreeNode } from '../components/Tree.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';

export const NodeInfoDetails = (props: { obj: DiagramNode; diagram: EditableDiagram }) => {
  const redraw = useRedraw();
  useEventListener('nodechanged', redraw, props.diagram);
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
