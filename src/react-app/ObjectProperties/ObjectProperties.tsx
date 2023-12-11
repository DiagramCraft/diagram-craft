import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
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
import { KeyMap } from '../../base-ui/keyMap.ts';
import { CanvasGridPanel } from './CanvasGridPanel.tsx';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { NodeStrokePanel } from './NodeStrokePanel.tsx';

export const ObjectProperties = (props: Props) => {
  const [type, setType] = useState('none');

  const callback = () => {
    if (props.diagram.selectionState.getSelectionType() === 'mixed') {
      setType('mixed');
    } else if (props.diagram.selectionState.isNodesOnly()) {
      setType('node');
    } else if (props.diagram.selectionState.isEdgesOnly()) {
      setType('edge');
    } else {
      setType('none');
    }
  };
  useEventListener(props.diagram.selectionState, 'change', callback);
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
            <NodeFillPanel diagram={props.diagram} />

            <ShadowPanel diagram={props.diagram} />

            <NodeStrokePanel diagram={props.diagram} />

            <TextPanel diagram={props.diagram} />

            <Accordion.Item className="cmp-accordion__item" value="transform">
              <AccordionTrigger>Transform</AccordionTrigger>
              <AccordionContent>
                <TransformProperties diagram={props.diagram} />
              </AccordionContent>
            </Accordion.Item>

            <CustomPropertiesPanel diagram={props.diagram} />
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

            <CanvasGridPanel
              diagram={props.diagram}
              actionMap={props.actionMap}
              keyMap={props.keyMap}
            />

            <CanvasGuidesProperties
              diagram={props.diagram}
              actionMap={props.actionMap}
              keyMap={props.keyMap}
            />

            <CanvasSnapPanel
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
