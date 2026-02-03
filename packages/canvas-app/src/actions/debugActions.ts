import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import {
  serializeDiagramDocument,
  serializeDiagramElement
} from '@diagram-craft/model/serialization/serialize';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert } from '@diagram-craft/utils/assert';
import { $tStr } from '@diagram-craft/utils/localize';
import { cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Box } from '@diagram-craft/geometry/box';
import { transformElements } from '@diagram-craft/model/diagramElement';
import { _p } from '@diagram-craft/geometry/point';
import { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';
import { toYAML } from '@diagram-craft/utils/yaml';
import { createStencilDiagram } from '@diagram-craft/canvas-app/diagramThumbnail';

export const debugActions = (context: ActionContext) => ({
  DOCUMENT_DUMP: new DumpDocument(context),
  SELECTION_DUMP: new DumpSelectionAction(context),
  STENCIL_MAKE_STENCIL: new MakeStencilSelectionAction(context),
  SELECTION_REDRAW: new RedrawAction(context)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof debugActions> {}
  }
}

class DumpDocument extends AbstractAction {
  name = $tStr('action.DOCUMENT_DUMP.name', 'Dump Document');

  execute(): void {
    serializeDiagramDocument(this.context.model.activeDiagram.document).then(e => {
      console.log(JSON.stringify(e, undefined, '  '));
    });
  }
}

class DumpSelectionAction extends AbstractAction {
  name = $tStr('action.SELECTION_DUMP.name', 'Dump');

  execute(): void {
    this.context.model.activeDiagram.selection.elements.forEach(e => {
      const s = serializeDiagramElement(e);
      console.log(JSON.stringify(s, undefined, '  '));
    });
  }
}

class MakeStencilSelectionAction extends AbstractAction {
  name = $tStr('action.STENCIL_MAKE_STENCIL.name', 'Make Stencil');

  execute(): void {
    const { layer, diagram } = createStencilDiagram(this.context.model.activeDocument.registry);

    const cloned = cloneElements(this.context.model.activeDiagram.selection.elements, layer);

    const bb = Box.boundingBox(cloned.map(e => e.bounds));

    UnitOfWork.executeSilently(diagram, uow =>
      transformElements(cloned, [new Translation(_p(-bb.x, -bb.y))], uow)
    );

    const root: { elements: Array<SerializedElement> } = { elements: [] };
    cloned.forEach(e => {
      root.elements.push(cleanStencil(serializeDiagramElement(e)));
    });

    console.log(toYAML(root));
  }
}

const cleanStencil = (s: SerializedElement) => {
  if (s.type === 'node') {
    delete s.anchors;
  }
  s.children?.forEach(cleanStencil);

  return s;
};

class RedrawAction extends AbstractAction {
  name = $tStr('action.SELECTION_REDRAW.name', 'Redraw');

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
