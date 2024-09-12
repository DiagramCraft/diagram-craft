import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';

declare global {
  interface ActionMap extends ReturnType<typeof styleCopyActions> {}
}

export const styleCopyActions = (state: ActionConstructionParameters) => ({
  STYLE_COPY: new StyleCopyAction(state.diagram),
  STYLE_PASTE: new StylePasteAction(state.diagram)
});

let currentNodeStyle: NodeProps = {};
let currentEdgeStyle: EdgeProps = {};

export class StyleCopyAction extends AbstractSelectionAction {
  constructor(diagram: Diagram) {
    super(diagram, MultipleType.SingleOnly, ElementType.Both);
  }

  execute(): void {
    if (this.diagram.selectionState.isNodesOnly()) {
      currentNodeStyle = deepClone(this.diagram.selectionState.nodes[0].storedProps);
    } else if (this.diagram.selectionState.isEdgesOnly()) {
      currentEdgeStyle = deepClone(this.diagram.selectionState.edges[0].storedProps);
    } else {
      VERIFY_NOT_REACHED();
    }
  }
}

export class StylePasteAction extends AbstractSelectionAction {
  constructor(diagram: Diagram) {
    super(diagram, MultipleType.Both, ElementType.Both);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);
    for (const e of this.diagram.selectionState.elements) {
      if (isNode(e)) {
        e.updateProps(p => {
          for (const k in currentNodeStyle) {
            // @ts-ignore
            p[k] = deepMerge({}, p[k], currentNodeStyle[k]);
          }
          console.log(p);
        }, uow);
      } else if (isEdge(e)) {
        e.updateProps(p => {
          for (const k in currentEdgeStyle) {
            // @ts-ignore
            p[k] = deepMerge({}, p[k], currentEdgeStyle[k]);
          }
        }, uow);
      } else {
        VERIFY_NOT_REACHED();
      }
    }
    commitWithUndo(uow, 'Style Paste');
  }
}
