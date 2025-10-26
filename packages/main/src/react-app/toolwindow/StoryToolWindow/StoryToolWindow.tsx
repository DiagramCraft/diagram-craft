import { StoriesPanel } from './StoriesPanel';
import { StoryPlayerPanel } from './StoryPlayerPanel';
import { ToolWindow } from '../ToolWindow';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbPlus } from 'react-icons/tb';
import { useState } from 'react';
import { useDocument } from '../../../application';

export const StoryToolWindow = () => {
  const document = useDocument();
  const [showNewStoryDialog, setShowNewStoryDialog] = useState(false);
  const [newStoryName, setNewStoryName] = useState('');

  const handleCreateStory = () => {
    if (newStoryName.trim()) {
      document.stories.addStory(newStoryName);
      setNewStoryName('');
      setShowNewStoryDialog(false);
    }
  };

  return (
    <>
      <ToolWindow.Root id={'stories'} defaultTab={'stories'}>
        <ToolWindow.Tab id={'stories'} title={'Stories'}>
          <ToolWindow.TabContent>
            <ToolWindow.TabActions>
              <Button type={'icon-only'} onClick={() => setShowNewStoryDialog(true)}>
                <TbPlus />
              </Button>
            </ToolWindow.TabActions>
            <StoriesPanel />
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
        <ToolWindow.Tab
          id={'player'}
          title={'Player'}
          disabled={document.stories.stories.length === 0}
        >
          <ToolWindow.TabContent>
            <StoryPlayerPanel />
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      </ToolWindow.Root>

      <Dialog
        title="New Story"
        open={showNewStoryDialog}
        onClose={() => setShowNewStoryDialog(false)}
        buttons={[
          {
            type: 'cancel',
            label: 'Cancel',
            onClick: () => setShowNewStoryDialog(false)
          },
          {
            type: 'default',
            label: 'Create',
            onClick: handleCreateStory
          }
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label>Name</label>
            <TextInput value={newStoryName} onChange={v => setNewStoryName(v ?? '')} />
          </div>
        </div>
      </Dialog>
    </>
  );
};
