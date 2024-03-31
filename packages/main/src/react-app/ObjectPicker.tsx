import { DiagramNode } from '../model/diagramNode.ts';
import { useDiagram } from './context/DiagramContext.ts';
import { Diagram } from '../model/diagram.ts';
import { Layer } from '../model/diagramLayer.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { PickerCanvas } from './PickerCanvas.tsx';
import { DiagramDocument } from '../model/diagramDocument.ts';

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const nodes = diagram.nodeDefinitions.getAll();

  const diagrams = nodes
    .filter(n => n.type !== 'group')
    .map(n => {
      const dest = new Diagram(n.type, n.type, diagram.nodeDefinitions, diagram.edgeDefinitions);
      dest.layers.add(new Layer('default', 'Default', [], dest), UnitOfWork.throwaway(dest));
      dest.layers.active.addElement(
        new DiagramNode(
          n.type,
          n.type,
          {
            x: 1,
            y: 1,
            w: props.size - 2,
            h: props.size - 2,
            r: 0
          },
          dest,
          dest.layers.active
        ),
        new UnitOfWork(dest)
      );

      dest.document = new DiagramDocument([dest]);

      return dest;
    });

  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map((d, idx) => (
        <div
          key={idx}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', nodes[idx].type);
            ev.dataTransfer.setData('application/x-diagram-craft-node-type', nodes[idx].type);
          }}
          style={{ background: 'transparent' }}
        >
          <PickerCanvas width={props.size} height={props.size} diagram={d} />
        </div>
      ))}
    </div>
  );
};

type Props = {
  size: number;
};
