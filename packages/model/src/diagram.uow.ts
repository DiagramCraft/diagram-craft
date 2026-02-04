import { Snapshot, UnitOfWork, UOWAdapter } from '@diagram-craft/model/unitOfWork';
import { DiagramProps } from '@diagram-craft/model/diagramProps';
import { Diagram } from '@diagram-craft/model/diagram';
import { Box } from '@diagram-craft/geometry/box';
import { assert } from '@diagram-craft/utils/assert';
import { deepClone } from '@diagram-craft/utils/object';

interface DiagramSnapshot extends Snapshot {
  _snapshotType: 'diagram';
  name: string;
  props: DiagramProps;
  bounds: Omit<Box, 'r'>;
}

export class DiagramUOWAdapter implements UOWAdapter<DiagramSnapshot, Diagram> {
  id = (e: Diagram) => e.id;

  restore(snapshot: DiagramSnapshot, element: Diagram, uow: UnitOfWork): void {
    element.setBounds(snapshot.bounds, uow);
    element.setName(snapshot.name, uow);
    element._setProps(snapshot.props, uow);
  }

  snapshot(element: Diagram): DiagramSnapshot {
    return {
      _snapshotType: 'diagram',
      name: element.name,
      props: deepClone(element.props),
      bounds: deepClone(element.bounds)
    };
  }

  update(diagram: Diagram, elementId: string, snapshot: DiagramSnapshot, uow: UnitOfWork): void {
    assert.true(diagram.id === elementId);
    this.restore(snapshot, diagram, uow);
  }
}
