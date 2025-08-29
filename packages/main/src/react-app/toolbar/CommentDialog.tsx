import { useState, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Comment } from '@diagram-craft/model/comment';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { UserState } from '../../UserState';

type CommentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram;
  selectedElement?: DiagramElement;
  commentToEdit?: Comment;
  onCommentUpdated?: (comment: Comment) => void;
};

export const CommentDialog = (props: CommentDialogProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const isEditing = !!props.commentToEdit;

  useEffect(() => {
    if (props.open) {
      setMessage(props.commentToEdit?.message ?? '');
      setSubmitError(undefined);
      setIsSubmitting(false);
    }
  }, [props.open, props.commentToEdit]);

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSubmitting) {
      e.preventDefault();
      return;
    }

    if (!message.trim()) {
      setSubmitError('Please enter a comment message');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(undefined);

    try {
      if (isEditing && props.commentToEdit) {
        const updatedComment = new Comment(
          props.diagram,
          props.commentToEdit.type,
          props.commentToEdit.id,
          message.trim(),
          props.commentToEdit.author,
          props.commentToEdit.date,
          props.commentToEdit.state,
          props.commentToEdit.element,
          props.commentToEdit.parentId,
          props.commentToEdit.userColor
        );

        props.diagram.document.commentManager.updateComment(updatedComment);
        props.onCommentUpdated?.(updatedComment);
      } else {
        const userState = UserState.get().awarenessState;
        const comment = new Comment(
          props.diagram,
          props.selectedElement ? 'element' : 'diagram',
          newid(),
          message.trim(),
          userState.name,
          new Date(),
          'unresolved',
          props.selectedElement,
          undefined,
          userState.color
        );

        props.diagram.document.commentManager.addComment(comment);
      }

      handleCancel();
    } catch (error) {
      setSubmitError(
        `Failed to ${isEditing ? 'update' : 'add'} comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setMessage('');
    setSubmitError(undefined);
    setIsSubmitting(false);
    props.onOpenChange(false);
  };

  const handleClose = () => {
    handleCancel();
  };

  return (
    <Dialog
      title={isEditing ? 'Edit Comment' : 'Add Comment'}
      open={props.open}
      onClose={handleClose}
      buttons={[
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: handleCancel
        },
        {
          label: isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update' : 'Add'),
          type: 'default',
          onClick: handleSubmit
        }
      ]}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <TextArea
          value={message}
          onChange={value => setMessage(value ?? '')}
          placeholder="Enter comment..."
          rows={4}
          style={{
            resize: 'none',
            minHeight: '80px'
          }}
          autoFocus
        />

        {submitError && (
          <div
            style={{
              color: 'var(--destructive-fg)',
              fontSize: '12px'
            }}
          >
            {submitError}
          </div>
        )}
      </div>
    </Dialog>
  );
};
