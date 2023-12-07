import React from 'react';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { ObjectPicker } from './components/ObjectPicker.tsx';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { Diagram } from '../model-viewer/diagram.ts';
import { DiagramNode } from '../model-viewer/diagramNode.ts';
import { newid } from '../utils/id.ts';

export const canvasDropHandler = ($d: Diagram) => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    $d.addNode(
      new DiagramNode(
        newid(),
        e.dataTransfer.getData('application/x-diagram-craft-node-type'),
        {
          pos: $d.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent)),
          size: { w: 100, h: 100 },
          rotation: 0
        },
        undefined
      )
    );
  };
};

export const canvasDragOverHandler = () => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
};

export const PickerToolWindow = (props: Props) => {
  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['basic-shapes']}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker diagram={props.diagram} size={30} />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
