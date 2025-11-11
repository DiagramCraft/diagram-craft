import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { deepMerge } from '@diagram-craft/utils/object';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext } from '@diagram-craft/canvas/action';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof styleCopyActions> {}
  }
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
    if (this.context.model.activeDiagram.selection.isNodesOnly()) {
      currentNodeStyle = this.context.model.activeDiagram.selection.nodes[0]!.storedPropsCloned;
    } else if (this.context.model.activeDiagram.selection.isEdgesOnly()) {
      currentEdgeStyle = this.context.model.activeDiagram.selection.edges[0]!.storedPropsCloned;
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
    for (const e of this.context.model.activeDiagram.selection.elements) {
      if (isNode(e)) {
        e.updateProps(p => {
          for (const k in currentNodeStyle) {
            // @ts-expect-error
            p[k] = deepMerge({}, p[k], currentNodeStyle[k]);
          }
        }, uow);
      } else if (isEdge(e)) {
        e.updateProps(p => {
          for (const k in currentEdgeStyle) {
            // @ts-expect-error
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
