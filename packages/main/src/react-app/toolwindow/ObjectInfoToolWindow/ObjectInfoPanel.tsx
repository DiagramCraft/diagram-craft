import { useCallback, useEffect, useState } from 'react';
import { useDiagram } from '../../../application';
import { SelectionInfoDetails } from './SelectionInfoDetails';
import { NodeInfoDetails } from './NodeInfoDetails';
import { EdgeInfoDetails } from './EdgeInfoDetails';
import { DiagramInfoDetails } from './DiagramInfoDetails';
import { ToolWindowPanel } from '../ToolWindowPanel';
import styles from './ObjectInfoPanel.module.css';

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
      <div className={styles.objectInfoToolWindow}>
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
