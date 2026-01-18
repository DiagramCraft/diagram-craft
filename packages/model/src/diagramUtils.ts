import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { Box } from '@diagram-craft/geometry/box';

export const growBoundsForSelection = (diagram: Diagram, uow: UnitOfWork) => {
  const selectionBounds = Box.boundingBox(
    diagram.selection.nodes.map(e => e.bounds),
    true
  );
  const diagramBounds = { ...diagram.bounds, r: 0 };
  if (!Box.contains(diagramBounds, selectionBounds)) {
    diagram.setBounds(Box.boundingBox([diagramBounds, Box.grow(selectionBounds, 20)], true), uow);
  }
};
