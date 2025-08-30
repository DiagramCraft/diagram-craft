import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { CommentDialog } from '../components/CommentDialog';
import { Comment } from '@diagram-craft/model/comment';
import { assert } from '@diagram-craft/utils/assert';

export const commentActions = (application: Application) => ({
  COMMENT_ADD: new CommentAddAction(application),
  COMMENT_EDIT: new CommentEditAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof commentActions> {}
}

class CommentAddAction extends AbstractAction<undefined, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selectionState = diagram.selectionState;
    const selectedElement =
      selectionState.elements.length === 1 ? selectionState.elements[0] : undefined;

    this.context.ui.showDialog(
      CommentDialog.create(
        {
          diagram,
          selectedElement
        },
        () => {}
      )
    );
  }
}

class CommentEditAction extends AbstractAction<{ comment: Comment }, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(arg: Partial<{ comment: Comment }>): void {
    assert.present(arg.comment);
    const diagram = this.context.model.activeDiagram;

    this.context.ui.showDialog(
      CommentDialog.create(
        {
          diagram,
          selectedElement: arg.comment.element,
          comment: arg.comment
        },
        () => {}
      )
    );
  }
}
