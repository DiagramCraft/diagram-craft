import { Tree } from '@diagram-craft/app-components/Tree';
import { ObjectTreeNode } from './ObjectTreeNode';
import { useDiagram } from '../../context/DiagramContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { DiagramElement } from '@diagram-craft/model/diagramElement';

export const MetadataDetails = (props: { obj: DiagramElement }) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
    <Tree.Root>
      <Tree.Node isOpen={true}>
        <Tree.NodeLabel>metadata</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={props.obj.metadata} />
        </Tree.Children>
      </Tree.Node>
    </Tree.Root>
  );
};
