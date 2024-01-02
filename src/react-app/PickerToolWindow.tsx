import React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { ObjectPicker } from './components/ObjectPicker.tsx';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { newid } from '../utils/id.ts';
import { ElementAddUndoableAction } from '../model/diagramUndoActions.ts';
import { Diagram } from '../model/diagram.ts';

export const canvasDropHandler = ($d: Diagram) => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    const nodeType = e.dataTransfer.getData('application/x-diagram-craft-node-type');
    const nodeDef = $d.nodeDefinitions.get(nodeType);

    const nd = new DiagramNode(
      newid(),
      nodeType,
      {
        pos: $d.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent)),
        size: nodeDef.getInitialConfig().size,
        rotation: 0
      },
      $d,
      $d.layers.active,
      nodeDef.getDefaultProps('canvas')
    );

    $d.undoManager.addAndExecute(new ElementAddUndoableAction([nd], $d));

    $d.selectionState.clear();
    $d.selectionState.toggle(nd);

    if (nodeType === 'text') {
      setTimeout(() => {
        $d.nodeDefinitions.get(nodeType)?.requestFocus(nd);
      }, 10);
    }
  };
};

export const canvasDragOverHandler = () => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
};

export const PickerToolWindow = () => {
  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['basic-shapes']}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker size={35} />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
