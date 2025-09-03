import { useCallback, useEffect, useState } from 'react';
import { SelectionInfoDetails } from './SelectionInfoDetails';
import { NodeInfoDetails } from './NodeInfoDetails';
import { EdgeInfoDetails } from './EdgeInfoDetails';
import { useDiagram } from '../../../application';
import { DiagramInfoDetails } from './DiagramInfoDetails';
import { $c } from '@diagram-craft/utils/classname';
import * as Tabs from '@radix-ui/react-tabs';

export const ObjectInfoToolWindow = () => {
  const diagram = useDiagram();
  const [state, setState] = useState<'selection' | 'node' | 'edge' | undefined>(undefined);
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const [edgeId, setEdgeId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<string>('object');

  const callback = useCallback(() => {
    const selectionType = diagram.selectionState.getSelectionType();
    if (selectionType === 'single-node' || selectionType === 'single-label-node') {
      setState('node');
      setNodeId(diagram.selectionState.nodes[0].id);
    } else if (selectionType === 'single-edge') {
      setState('edge');
      setEdgeId(diagram.selectionState.edges[0].id);
    } else if (!diagram.selectionState.isEmpty()) {
      setState('selection');
    } else {
      setState(undefined);
    }
  }, [diagram.selectionState]);

  useEffect(() => {
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [callback, diagram.selectionState]);

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'object'}>
          Selection Info
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value={'object'}>
        <div className={'cmp-panel__headless'}>
          {state === 'selection' && <SelectionInfoDetails obj={diagram.selectionState} />}
          {state === 'node' && <NodeInfoDetails obj={diagram.nodeLookup.get(nodeId!)!} />}
          {state === 'edge' && <EdgeInfoDetails obj={diagram.edgeLookup.get(edgeId!)!} />}
          {state === undefined && <DiagramInfoDetails obj={diagram} />}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
};
