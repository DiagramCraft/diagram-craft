import { useDiagram } from '../../context/DiagramContext';
import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { newid } from '@diagram-craft/utils/id';
import { StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();

  const stencils = props.package.stencils;
  const diagrams = stencils.map((n): [Diagram, DiagramNode] => {
    const uow = UnitOfWork.immediate(diagram);

    const dest = new Diagram(
      newid(),
      n.node.name,
      new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
    );

    dest.layers.add(new Layer('default', 'Default', [], dest), uow);

    const node = n.node(dest);
    dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
    dest.viewBox.offset = { x: -5, y: -5 };
    dest.layers.active.addElement(node, uow);

    return [dest, node];
  });

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map(([d, n], idx) => (
        <div
          key={idx}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', props.package + '/' + stencils[idx].id);

            // Note: we know for a fact that there's only one layer in the diagram
            const elements = d.layers.active.elements;
            ev.dataTransfer.setData(
              'application/x-diagram-craft-elements',
              JSON.stringify({
                elements: elements.map(e => serializeDiagramElement(e)),
                attachments: {},
                dimensions: n.bounds
              })
            );
          }}
          style={{ background: 'transparent' }}
          data-width={d.viewBox.dimensions.w}
        >
          <PickerCanvas
            width={props.size}
            height={props.size}
            diagramWidth={d.viewBox.dimensions.w}
            diagramHeight={d.viewBox.dimensions.h}
            diagram={d}
            name={
              stencils[idx].name ??
              diagram.document.nodeDefinitions.get(n.nodeType).name ??
              'unknown'
            }
          />
        </div>
      ))}
    </div>
  );
};

type Props = {
  size: number;
  package: StencilPackage;
};
