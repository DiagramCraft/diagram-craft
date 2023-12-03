import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { LineProperties } from './LineProperties.tsx';
import { StrokeProperties } from './StrokeProperties.tsx';
import { FillProperties } from './FillProperties.tsx';

export const ObjectProperties = (props: Props) => {
  const [type, setType] = useState('none');

  useEventListener(
    'change',
    () => {
      if (
        props.diagram.selectionState.nodes.length > 0 &&
        props.diagram.selectionState.edges.length > 0
      ) {
        setType('mixed');
      } else if (props.diagram.selectionState.nodes.length > 0) {
        setType('node');
      } else if (props.diagram.selectionState.edges.length > 0) {
        setType('edge');
      } else {
        setType('none');
      }
    },
    props.diagram.selectionState
  );

  return (
    <>
      <Accordion.Root
        className="cmp-accordion"
        type="multiple"
        defaultValue={['fill', 'stroke', 'line']}
      >
        {(type === 'node' || type === 'mixed') && (
          <>
            <Accordion.Item className="cmp-accordion__item" value="fill">
              <AccordionTrigger>Fill</AccordionTrigger>
              <AccordionContent>
                <FillProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>

            <Accordion.Item className="cmp-accordion__item" value="stroke">
              <AccordionTrigger>Stroke</AccordionTrigger>
              <AccordionContent>
                <StrokeProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>
          </>
        )}

        {type === 'edge' && (
          <Accordion.Item className="cmp-accordion__item" value="line">
            <AccordionTrigger>Line</AccordionTrigger>
            <AccordionContent>
              <LineProperties diagram={props.diagram} />
            </AccordionContent>
          </Accordion.Item>
        )}
      </Accordion.Root>
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
