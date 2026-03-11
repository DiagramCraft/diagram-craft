import { useCallback, useEffect, useState } from 'react';
import { useDiagram } from '../../../application';
import { SelectionInfoDetails } from './SelectionInfoDetails';
import { DiagramInfoDetails } from './DiagramInfoDetails';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './ObjectInfoPanel.module.css';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { Tree } from '@diagram-craft/app-components/Tree';
import { ObjectTreeNode } from './ObjectTreeNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

const NodeInfoDetails = (props: NodeInfoDetailsProps) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);
  return (
    <Tree.Root className={styles.eTree}>
      <Tree.Node>
        <Tree.NodeLabel>id</Tree.NodeLabel>
        <Tree.NodeCell>{props.obj.id}</Tree.NodeCell>
      </Tree.Node>
      <Tree.Node>
        <Tree.NodeLabel>nodeType</Tree.NodeLabel>
        <Tree.NodeCell>{props.obj.nodeType}</Tree.NodeCell>
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

type NodeInfoDetailsProps = { obj: DiagramNode };

const EdgeInfoDetails = (props: EdgeInfoDetailsProps) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram, 'elementChange', redraw);

  if (!props.obj) return null;
  return (
    <Tree.Root className={styles.eTree}>
      <Tree.Node>
        <Tree.NodeLabel>id</Tree.NodeLabel>
        <Tree.NodeCell>{props.obj.id}</Tree.NodeCell>
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

type EdgeInfoDetailsProps = { obj: DiagramEdge };

export const ObjectInfoPanel = () => {
  const diagram = useDiagram();
  const [state, setState] = useState<'selection' | 'node' | 'edge' | undefined>(undefined);
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const [edgeId, setEdgeId] = useState<string | undefined>(undefined);

  const callback = useCallback(() => {
    const selectionType = diagram.selection.type;
    if (selectionType === 'single-node' || selectionType === 'single-label-node') {
      setState('node');
      setNodeId(diagram.selection.nodes[0]!.id);
    } else if (selectionType === 'single-edge') {
      setState('edge');
      setEdgeId(diagram.selection.edges[0]!.id);
    } else if (!diagram.selection.isEmpty()) {
      setState('selection');
    } else {
      setState(undefined);
    }
  }, [diagram.selection]);

  useEffect(() => {
    callback();

    diagram.selection.on('change', callback);
    return () => {
      diagram.selection.off('change', callback);
    };
  }, [callback, diagram.selection]);

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'objectInfo'}
      title={'Object Info'}
      style={{ padding: '0.25rem 0' }}
    >
      <div className={styles.icObjectInfoToolWindow}>
        {state === 'selection' && <SelectionInfoDetails obj={diagram.selection} />}
        {state === 'node' && diagram.nodeLookup.get(nodeId!) && (
          <NodeInfoDetails obj={diagram.nodeLookup.get(nodeId!)!} />
        )}
        {state === 'edge' && diagram.edgeLookup.get(edgeId!) && (
          <EdgeInfoDetails obj={diagram.edgeLookup.get(edgeId!)!} />
        )}
        {state === undefined && <DiagramInfoDetails obj={diagram} />}
      </div>
    </ToolWindowPanel>
  );
};
