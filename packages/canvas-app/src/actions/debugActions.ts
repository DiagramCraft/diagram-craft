import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import {
  serializeDiagramDocument,
  serializeDiagramElement
} from '@diagram-craft/model/serialization/serialize';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert } from '@diagram-craft/utils/assert';

export const debugActions = (context: ActionContext) => ({
  DOCUMENT_DUMP: new DumpDocument(context),
  SELECTION_DUMP: new DumpSelectionAction(context),
  SELECTION_REDRAW: new RedrawAction(context)
});

declare global {
  interface ActionMap extends ReturnType<typeof debugActions> {}
}

class DumpDocument extends AbstractAction {
  execute(): void {
    serializeDiagramDocument(this.context.model.activeDiagram.document).then(e => {
      console.log(JSON.stringify(e, undefined, '  '));
    });
  }
}

class DumpSelectionAction extends AbstractAction {
  execute(): void {
    this.context.model.activeDiagram.selection.elements.forEach(e => {
      const s = serializeDiagramElement(e);
      console.log(JSON.stringify(s, undefined, '  '));
    });
  }
}

class RedrawAction extends AbstractAction {
  execute(): void {
    const diagram = this.context.model.activeDiagram;
    assert.arrayNotEmpty(diagram.selection.nodes);

    UnitOfWork.execute(diagram, uow => {
      diagram.selection.nodes[0]!.transform([new Translation({ x: 10, y: 10 })], uow);
    });

    setTimeout(() => {
      UnitOfWork.execute(diagram, uow => {
        diagram.selection.nodes[0]!.transform([new Translation({ x: -10, y: -10 })], uow);
      });
    }, 200);
  }
}
