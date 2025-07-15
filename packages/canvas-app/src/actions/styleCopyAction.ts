import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { deepMerge } from '@diagram-craft/utils/object';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof styleCopyActions> {}
}

export const styleCopyActions = (context: ActionContext) => ({
  STYLE_COPY: new StyleCopyAction(context),
  STYLE_PASTE: new StylePasteAction(context)
});

let currentNodeStyle: NodeProps = {};
let currentEdgeStyle: EdgeProps = {};

export class StyleCopyAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.SingleOnly, ElementType.Both);
  }

  execute(): void {
    if (this.context.model.activeDiagram.selectionState.isNodesOnly()) {
      currentNodeStyle = this.context.model.activeDiagram.selectionState.nodes[0].storedPropsCloned;
    } else if (this.context.model.activeDiagram.selectionState.isEdgesOnly()) {
      currentEdgeStyle = this.context.model.activeDiagram.selectionState.edges[0].storedPropsCloned;
    } else {
      VERIFY_NOT_REACHED();
    }
  }
}

export class StylePasteAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    for (const e of this.context.model.activeDiagram.selectionState.elements) {
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
