import { useState } from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Button } from '@diagram-craft/app-components/Button';
import { Comment } from '@diagram-craft/model/comment';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { UserState } from '../../UserState';

type CommentPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram;
  selectedElement?: DiagramElement;
  children: React.ReactNode;
};

export const CommentPopover = (props: CommentPopoverProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

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

      handleCancel();
    } catch (error) {
      setSubmitError(
        `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  return (
    <Popover.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Popover.Trigger>{props.children}</Popover.Trigger>
      <Popover.Content sideOffset={1}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '90%'
          }}
        >
          <h2 className={'util-hstack'} style={{ gap: '0.5rem' }}>
            Comment
          </h2>

          <TextArea
            value={message}
            onChange={value => setMessage(value ?? '')}
            placeholder="Enter comment..."
            rows={2}
            style={{
              resize: 'none',
              minHeight: '60px'
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

          <div
            style={{
              width: '100%',
              display: 'flex',
              gap: '6px',
              justifyContent: 'flex-end',
              marginTop: '0.5rem'
            }}
          >
            <Button type="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
