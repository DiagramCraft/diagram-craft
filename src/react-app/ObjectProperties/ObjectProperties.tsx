import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { LineProperties } from './LineProperties.tsx';
import { StrokeProperties } from './StrokeProperties.tsx';
import { FillProperties } from './FillProperties.tsx';
import { TextProperties } from './TextProperties.tsx';
import { TransformProperties } from './TransformProperties.tsx';
import { CustomProperties } from './CustomProperties.tsx';
import { ShadowProperties } from './ShadowProperties.tsx';
import { CanvasProperties } from './CanvasProperties.tsx';
import { CanvasGuidesProperties } from './CanvasGuidesProperties.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';
import { CanvasGridProperties } from './CanvasGridProperties.tsx';
import { CanvasSnapProperties } from './CanvasSnapProperties.tsx';

export const ObjectProperties = (props: Props) => {
  const [type, setType] = useState('none');

  const callback = () => {
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
  };
  useEventListener('change', callback, props.diagram.selectionState);
  useEffect(() => {
    callback();
  }, []);

  return (
    <>
      <Accordion.Root
        className="cmp-accordion"
        type="multiple"
        defaultValue={[
          'fill',
          'stroke',
          'line',
          'text',
          'transform',
          'snap',
          'grid',
          'canvas',
          'snap'
        ]}
      >
        {(type === 'node' || type === 'mixed') && (
          <>
            <Accordion.Item className="cmp-accordion__item" value="fill">
              <AccordionTrigger>Fill</AccordionTrigger>
              <AccordionContent>
                <FillProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>
            <StrokeProperties diagram={props.diagram} />

            <ShadowProperties diagram={props.diagram} />

            <Accordion.Item className="cmp-accordion__item" value="text">
              <AccordionTrigger>Text</AccordionTrigger>
              <AccordionContent>
                <TextProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>
            <Accordion.Item className="cmp-accordion__item" value="transform">
              <AccordionTrigger>Transform</AccordionTrigger>
              <AccordionContent>
                <TransformProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>

            <CustomProperties diagram={props.diagram} />
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

        {type === 'none' && (
          <>
            <Accordion.Item className="cmp-accordion__item" value="line">
              <AccordionTrigger>Canvas</AccordionTrigger>
              <AccordionContent>
                <CanvasProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>

            <CanvasGridProperties
              diagram={props.diagram}
              actionMap={props.actionMap}
              keyMap={props.keyMap}
            />

            <CanvasGuidesProperties
              diagram={props.diagram}
              actionMap={props.actionMap}
              keyMap={props.keyMap}
            />

            <CanvasSnapProperties
              diagram={props.diagram}
              actionMap={props.actionMap}
              keyMap={props.keyMap}
            />
          </>
        )}
      </Accordion.Root>
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
