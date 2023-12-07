import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useCallback, useEffect, useState } from 'react';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { SelectionInfoDetails } from './SelectionInfoDetails.tsx';
import { NodeInfoDetails } from './NodeInfoDetails.tsx';
import { EdgeInfoDetails } from './EdgeInfoDetails.tsx';

export const ObjectInfo = (props: Props) => {
  const [state, setState] = useState<'selection' | 'node' | 'edge' | undefined>(undefined);
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const [edgeId, setEdgeId] = useState<string | undefined>(undefined);

  const callback = useCallback(() => {
    if (
      props.diagram.selectionState.nodes.length === 1 &&
      props.diagram.selectionState.edges.length === 0
    ) {
      setState('node');
      setNodeId(props.diagram.selectionState.nodes[0].id);
    } else if (
      props.diagram.selectionState.edges.length === 1 &&
      props.diagram.selectionState.nodes.length === 0
    ) {
      setState('edge');
      setEdgeId(props.diagram.selectionState.edges[0].id);
    } else if (props.diagram.selectionState.elements.length > 0) {
      setState('selection');
    } else {
      setState(undefined);
    }
  }, [
    props.diagram.selectionState.edges.length,
    props.diagram.selectionState.elements.length,
    props.diagram.selectionState.nodes.length
  ]);
  useEffect(() => {
    callback();

    props.diagram.selectionState.on('change', callback);
    return () => {
      props.diagram.selectionState.off('change', callback);
    };
  }, [callback, props.diagram.selectionState]);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['info']}>
      <Accordion.Item className="cmp-accordion__item" value="info">
        <AccordionTrigger>Info</AccordionTrigger>
        <AccordionContent>
          {state === 'selection' && <SelectionInfoDetails obj={props.diagram.selectionState} />}
          {state === 'node' && (
            <NodeInfoDetails diagram={props.diagram} obj={props.diagram.nodeLookup[nodeId!]} />
          )}
          {state === 'edge' && (
            <EdgeInfoDetails diagram={props.diagram} obj={props.diagram.edgeLookup[edgeId!]} />
          )}
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
