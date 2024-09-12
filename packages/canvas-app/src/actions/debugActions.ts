import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import {
  serializeDiagramDocument,
  serializeDiagramElement
} from '@diagram-craft/model/serialization/serialize';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export const debugActions = (state: ActionConstructionParameters) => ({
  DOCUMENT_DUMP: new DumpDocument(state.diagram),
  SELECTION_DUMP: new DumpSelectionAction(state.diagram),
  SELECTION_REDRAW: new RedrawAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof debugActions> {}
}

class DumpDocument extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    serializeDiagramDocument(this.diagram.document!).then(e => {
      console.log(JSON.stringify(e, undefined, '  '));
    });
  }
}

class DumpSelectionAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    this.diagram.selectionState.elements.forEach(e => {
      const s = serializeDiagramElement(e);
      console.log(JSON.stringify(s, undefined, '  '));
    });
  }
}

class RedrawAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    UnitOfWork.execute(this.diagram, uow => {
      this.diagram.selectionState.nodes[0].transform([new Translation({ x: 10, y: 10 })], uow);
    });

    setTimeout(() => {
      UnitOfWork.execute(this.diagram, uow => {
        this.diagram.selectionState.nodes[0].transform([new Translation({ x: -10, y: -10 })], uow);
      });
    }, 200);
  }
}
