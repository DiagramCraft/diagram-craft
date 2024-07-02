import { useCallback, useEffect, useState } from 'react';
import { AccordionTrigger } from '../../components/AccordionTrigger';
import { AccordionContent } from '../../components/AccordionContent';
import * as Accordion from '@radix-ui/react-accordion';
import { SelectionInfoDetails } from './SelectionInfoDetails';
import { NodeInfoDetails } from './NodeInfoDetails';
import { EdgeInfoDetails } from './EdgeInfoDetails';
import { useDiagram } from '../../context/DiagramContext';

export const ObjectInfoToolWindow = () => {
  const diagram = useDiagram();
  const [state, setState] = useState<'selection' | 'node' | 'edge' | undefined>(undefined);
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const [edgeId, setEdgeId] = useState<string | undefined>(undefined);

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
    <Accordion.Root
      className="cmp-accordion"
      disabled={true}
      type="multiple"
      defaultValue={['info']}
    >
      <Accordion.Item className="cmp-accordion__item" value="info">
        <AccordionTrigger>Info</AccordionTrigger>
        <AccordionContent>
          {state === 'selection' && <SelectionInfoDetails obj={diagram.selectionState} />}
          {state === 'node' && <NodeInfoDetails obj={diagram.nodeLookup.get(nodeId!)!} />}
          {state === 'edge' && <EdgeInfoDetails obj={diagram.edgeLookup.get(edgeId!)!} />}
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
