import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Comment } from '@diagram-craft/model/comment';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';

type CommentDialogProps = {
  open: boolean;
  onClose: () => void;
  diagram: Diagram;
  selectedElement?: DiagramElement;
};

export const CommentDialog = (props: CommentDialogProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent multiple submissions
    if (isSubmitting) {
      e.preventDefault();
      return;
    }

    if (!message.trim()) {
      setSubmitError('Please enter a comment message');
      e.preventDefault(); // Prevent dialog from closing
      return;
    }

    setIsSubmitting(true);
    setSubmitError(undefined);

    try {
      // Create the comment
      const comment = new Comment(
        props.diagram,
        props.selectedElement ? 'element' : 'diagram',
        newid(),
        message.trim(),
        'Test', // Username as requested
        new Date(),
        'unresolved',
        props.selectedElement
      );

      // Add comment to the comment manager
      props.diagram.document.commentManager.addComment(comment);


      // Close dialog and reset form
      handleCancel();
    } catch (error) {
      setSubmitError(
        `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      e.preventDefault(); // Prevent dialog from closing on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setMessage('');
    setSubmitError(undefined);
    setIsSubmitting(false);
    props.onClose();
  };

  const contextText = props.selectedElement 
    ? `Adding comment to ${props.selectedElement.type}: ${props.selectedElement.id}`
    : 'Adding comment to diagram';

  return (
    <Dialog
      title="Add Comment"
      open={props.open}
      onClose={handleCancel}
      buttons={[
        {
          type: 'cancel',
          label: 'Cancel',
          onClick: handleCancel
        },
        {
          type: 'default',
          label: isSubmitting ? 'Adding...' : 'Add Comment',
          onClick: handleSubmit
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '400px' }}>
        <div style={{ 
          fontSize: '14px', 
          color: 'var(--neutral-6)', 
          marginBottom: '8px' 
        }}>
          {contextText}
        </div>

        <TextArea
          value={message}
          onChange={(value) => setMessage(value ?? '')}
          placeholder="Enter your comment..."
          rows={4}
          style={{ 
            width: '100%',
            resize: 'vertical',
            minHeight: '100px'
          }}
          autoFocus
        />

        {submitError && (
          <div style={{ 
            color: 'var(--destructive-fg)', 
            fontSize: '14px',
            marginTop: '8px'
          }}>
            {submitError}
          </div>
        )}

        <div style={{ 
          fontSize: '12px', 
          color: 'var(--neutral-7)',
          marginTop: '4px'
        }}>
          Comment will be added by: Test
        </div>
      </div>
    </Dialog>
  );
};