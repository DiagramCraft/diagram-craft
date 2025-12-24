import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext } from '@diagram-craft/canvas/action';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { $tStr } from '@diagram-craft/utils/localize';

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

type CopyArg = { props: NodeProps | EdgeProps; type: 'node' | 'edge' };

export class StyleCopyAction extends AbstractSelectionAction<ActionContext, CopyArg> {
  name = $tStr('action.STYLE_COPY.name', 'Copy Style');

  constructor(context: ActionContext) {
    super(context, MultipleType.SingleOnly, ElementType.Both);
  }

  isEnabled(arg: Partial<CopyArg>): boolean {
    if (arg.props !== undefined) {
      return true;
    }
    return super.isEnabled(arg);
  }

  execute(arg: Partial<CopyArg>): void {
    // If props are provided, use them directly
    if (arg.props !== undefined) {
      if (arg.type === 'node') {
        currentNodeStyle = deepClone(arg.props as NodeProps);
      } else {
        currentEdgeStyle = deepClone(arg.props as EdgeProps);
      }
      return;
    } else {
      // Otherwise use the original behavior
      if (this.context.model.activeDiagram.selection.isNodesOnly()) {
        currentNodeStyle = deepClone(
          this.context.model.activeDiagram.selection.nodes[0]!.storedProps
        );
      } else if (this.context.model.activeDiagram.selection.isEdgesOnly()) {
        currentEdgeStyle = deepClone(
          this.context.model.activeDiagram.selection.edges[0]!.storedProps
        );
      } else {
        VERIFY_NOT_REACHED();
      }
    }
  }
}

type PasteArg = { elements: DiagramElement[] };

export class StylePasteAction extends AbstractSelectionAction<ActionContext, PasteArg> {
  name = $tStr('action.STYLE_PASTE.name', 'Paste Style');

  constructor(context: ActionContext) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  execute(arg: Partial<PasteArg>): void {
    const elements = arg.elements ?? this.context.model.activeDiagram.selection.elements;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    for (const e of elements) {
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
