import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { LineProperties } from './LineProperties.tsx';
import { StrokeProperties } from './StrokeProperties.tsx';
import { additionalHues, primaryColors } from './palette.ts';

export const ObjectProperties = (props: Props) => {
  const [fill, setFill] = useState<string>('transparent');

  useEventListener(
    'change',
    () => {
      const fillArray = unique(
        props.diagram.selectionState.nodes.map(n => n.props.fill?.color),
        e => e
      ).filter(Boolean);

      if (fillArray.length === 0) setFill('transparent');
      else if (fillArray.length === 1) setFill(fillArray[0]!);
      else setFill('transparent');
    },
    props.diagram.selectionState
  );

  const changeFill = (c: string) => {
    props.diagram.selectionState.nodes.forEach(n => {
      n.props.fill ??= {};
      n.props.fill.color = c;
      props.diagram.updateElement(n);
    });
    setFill(c);
  };

  return (
    <>
      <Accordion.Root
        className="cmp-accordion"
        type="multiple"
        defaultValue={['fill', 'stroke', 'line']}
      >
        <Accordion.Item className="cmp-accordion__item" value="fill">
          <AccordionTrigger>Fill</AccordionTrigger>
          <AccordionContent>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={fill ?? 'transparent'}
              onClick={changeFill}
            />
          </AccordionContent>
        </Accordion.Item>

        <Accordion.Item className="cmp-accordion__item" value="stroke">
          <AccordionTrigger>Stroke</AccordionTrigger>
          <AccordionContent>
            <StrokeProperties diagram={props.diagram} />
          </AccordionContent>
        </Accordion.Item>

        <Accordion.Item className="cmp-accordion__item" value="line">
          <AccordionTrigger>Line</AccordionTrigger>
          <AccordionContent>
            <LineProperties diagram={props.diagram} />
          </AccordionContent>
        </Accordion.Item>
      </Accordion.Root>
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
