import { useEffect } from 'react';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { LayerList } from './components/LayerList.tsx';

export const LayerToolWindow = (props: Props) => {
  const redraw = useRedraw();

  useEffect(() => {
    const onChange = () => {
      redraw();
    };
    props.diagram.selectionState.on('change', onChange);
    props.diagram.on('canvaschanged', onChange);
    props.diagram.on('nodechanged', onChange);
    props.diagram.on('noderemoved', onChange);
    props.diagram.on('nodeadded', onChange);
    props.diagram.on('edgechanged', onChange);
    props.diagram.on('edgeadded', onChange);
    props.diagram.on('edgeremoved', onChange);
    return () => {
      props.diagram.selectionState.off('change', onChange);
      props.diagram.off('canvaschanged', onChange);
      props.diagram.off('nodechanged', onChange);
      props.diagram.off('noderemoved', onChange);
      props.diagram.off('nodeadded', onChange);
      props.diagram.off('edgechanged', onChange);
      props.diagram.off('edgeadded', onChange);
      props.diagram.off('edgeremoved', onChange);
    };
  }, [props.diagram, redraw]);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['layers']}>
      <Accordion.Item className="cmp-accordion__item" value="layers">
        <AccordionTrigger>Layers</AccordionTrigger>
        <AccordionContent>
          <LayerList diagram={props.diagram} />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
