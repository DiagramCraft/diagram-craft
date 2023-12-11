import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { LineProperties } from './LineProperties.tsx';
import { NodeFillPanel } from './NodeFillPanel.tsx';
import { TextPanel } from './TextPanel.tsx';
import { TransformProperties } from './TransformProperties.tsx';
import { CustomPropertiesPanel } from './CustomPropertiesPanel.tsx';
import { ShadowPanel } from './ShadowPanel.tsx';
import { CanvasProperties } from './CanvasProperties.tsx';
import { CanvasGuidesProperties } from './CanvasGuidesProperties.tsx';
import { CanvasGridPanel } from './CanvasGridPanel.tsx';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { NodeStrokePanel } from './NodeStrokePanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';

export const ObjectProperties = () => {
  const diagram = useDiagram();

  const [type, setType] = useState('none');

  const callback = () => {
    if (diagram.selectionState.getSelectionType() === 'mixed') {
      setType('mixed');
    } else if (diagram.selectionState.isNodesOnly()) {
      setType('node');
    } else if (diagram.selectionState.isEdgesOnly()) {
      setType('edge');
    } else {
      setType('none');
    }
  };
  useEventListener(diagram.selectionState, 'change', callback);
  useEffect(callback, []);

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
          'snap',
          'custom'
        ]}
      >
        {(type === 'node' || type === 'mixed') && (
          <>
            <NodeFillPanel />

            <ShadowPanel />

            <NodeStrokePanel />

            <TextPanel />

            <Accordion.Item className="cmp-accordion__item" value="transform">
              <AccordionTrigger>Transform</AccordionTrigger>
              <AccordionContent>
                <TransformProperties />
              </AccordionContent>
            </Accordion.Item>

            <CustomPropertiesPanel />
          </>
        )}

        {type === 'edge' && (
          <Accordion.Item className="cmp-accordion__item" value="line">
            <AccordionTrigger>Line</AccordionTrigger>
            <AccordionContent>
              <LineProperties />
            </AccordionContent>
          </Accordion.Item>
        )}

        {type === 'none' && (
          <>
            <Accordion.Item className="cmp-accordion__item" value="line">
              <AccordionTrigger>Canvas</AccordionTrigger>
              <AccordionContent>
                <CanvasProperties />
              </AccordionContent>
            </Accordion.Item>

            <CanvasGridPanel />

            <CanvasGuidesProperties />

            <CanvasSnapPanel />
          </>
        )}
      </Accordion.Root>
    </>
  );
};
