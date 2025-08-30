import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { CommentDialog } from '../components/CommentDialog';
import { Comment } from '@diagram-craft/model/comment';
import { assert } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { UserState } from '../../UserState';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';

export const commentActions = (application: Application) => ({
  COMMENT_ADD: new CommentAddAction(application),
  COMMENT_EDIT: new CommentEditAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof commentActions> {}
}

class CommentAddAction extends AbstractSelectionAction<Application, { elementId: string }> {
  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Both, undefined, true);
  }

  execute(arg?: Partial<{ elementId: string }>): void {
    const diagram = this.context.model.activeDiagram;

    let selectedElement: DiagramElement | undefined;
    if (arg?.elementId) {
      selectedElement = diagram.lookup(arg?.elementId);
    } else {
      const selectionState = diagram.selectionState;
      selectedElement =
        selectionState.elements.length === 1 ? selectionState.elements[0] : undefined;
    }
    assert.present(selectedElement);

    this.context.ui.showDialog(
      CommentDialog.create(
        {
          diagram,
          selectedElement
        },
        data => {
          const userState = UserState.get().awarenessState;
          const comment = new Comment(
            diagram,
            selectedElement ? 'element' : 'diagram',
            newid(),
            data.message,
            userState.name,
            new Date(),
            'unresolved',
            selectedElement,
            undefined,
            userState.color
          );

          diagram.document.commentManager.addComment(comment);
        }
      )
    );
  }
}

class CommentEditAction extends AbstractAction<{ comment: Comment }, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(arg: Partial<{ comment: Comment }>): void {
    const comment = arg.comment;
    assert.present(comment);
    const diagram = this.context.model.activeDiagram;

    this.context.ui.showDialog(
      CommentDialog.create(
        {
          diagram,
          selectedElement: comment.element,
          comment: comment
        },
        data => {
          comment.edit(data.message);
          diagram.document.commentManager.updateComment(comment);
        }
      )
    );
  }
}
