import React, { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Comment } from '@diagram-craft/model/comment';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { DialogCommand } from '@diagram-craft/canvas/context';

type CommentDialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
  onOk?: (data: { message: string }) => void;
  diagram: Diagram;
  selectedElement?: DiagramElement;
  comment?: Comment;
  onCommentUpdated?: (comment: Comment) => void;
};

export const CommentDialog = (props: CommentDialogProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const isEditing = !!props.comment;

  useEffect(() => {
    if (props.open) {
      setMessage(props.comment?.message ?? '');
      setSubmitError(undefined);
      setIsSubmitting(false);
    }
  }, [props.open, props.comment]);

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
      props.onOk?.({ message: message.trim() });
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
    props.onCancel?.();
    props.onOpenChange?.(false);
  };

  return (
    <Dialog
      title={`${isEditing ? 'Edit' : 'Add'} Comment`}
      open={props.open}
      onClose={handleCancel}
      buttons={[
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: handleCancel
        },
        {
          label: isEditing ? 'Update' : 'Add',
          type: 'default',
          onClick: handleSubmit
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <TextArea
          value={message}
          onChange={value => setMessage(value ?? '')}
          placeholder="Enter comment..."
          rows={4}
          style={{ resize: 'none', minHeight: '80px' }}
          autoFocus
        />

        {submitError && <div style={{ color: 'var(--error-fg)' }}>{submitError}</div>}
      </div>
    </Dialog>
  );
};

CommentDialog.create = (
  props: { diagram: Diagram; selectedElement?: DiagramElement; comment?: Comment },
  onOk: (data: { message: string }) => void = () => {},
  onCancel: () => void = () => {}
): DialogCommand<
  { diagram: Diagram; selectedElement?: DiagramElement; comment?: Comment },
  { message: string }
> => {
  return {
    id: 'comment',
    props,
    onOk,
    onCancel
  };
};
