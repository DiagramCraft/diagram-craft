import { Tree } from '@diagram-craft/app-components/Tree';
import { TbMovie, TbPlus, TbTrash, TbEdit, TbPlayerPlay } from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDocument } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Button } from '@diagram-craft/app-components/Button';
import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useToolWindowControls } from '../ToolWindow';
import type { Story } from '@diagram-craft/model/documentStories';

export const StoriesListPanel = () => {
  const redraw = useRedraw();
  const document = useDocument();
  const stories = document.stories.stories;
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newStoryName, setNewStoryName] = useState('');
  const [selectedStory, setSelectedStory] = useState<Story | undefined>();
  const { switchTab } = useToolWindowControls();

  useEventListener(document.stories, 'change', redraw);

  const handleCreateStory = () => {
    if (newStoryName.trim()) {
      document.stories.addStory(newStoryName);
      setNewStoryName('');
      setShowNewDialog(false);
    }
  };

  const handleDeleteStory = (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    document.stories.deleteStory(story);
    if (selectedStory?.id === story.id) {
      setSelectedStory(undefined);
    }
  };

  const handleEditStory = (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStory(story);
    switchTab('editor');
  };

  const handlePlayStory = (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStory(story);
    switchTab('player');
  };

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'stories-list'}
      title={'Stories'}
      style={{ padding: '0.25rem 0' }}
    >
      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--gray-6)' }}>
        <Button onClick={() => setShowNewDialog(true)} style={{ width: '100%' }}>
          <TbPlus /> New Story
        </Button>
      </div>

      <Tree.Root className={'cmp-story-list'}>
        {stories.map(story => (
          <Tree.Node key={story.id} onClick={() => setSelectedStory(story)}>
            <Tree.NodeLabel>
              <TbMovie /> &nbsp;{story.name}
            </Tree.NodeLabel>
            <Tree.NodeCell className="cmp-tree__node__action">
              <span
                style={{ cursor: 'pointer' }}
                onClick={e => handlePlayStory(story, e)}
                title="Play story"
              >
                <TbPlayerPlay />
              </span>
              <span
                style={{ cursor: 'pointer' }}
                onClick={e => handleEditStory(story, e)}
                title="Edit story"
              >
                <TbEdit />
              </span>
              <span
                style={{ cursor: 'pointer' }}
                onClick={e => handleDeleteStory(story, e)}
                title="Delete story"
              >
                <TbTrash />
              </span>
            </Tree.NodeCell>
            {story.steps.length > 0 && (
              <Tree.Children>
                <Tree.Node>
                  <Tree.NodeLabel style={{ fontStyle: 'italic', color: 'var(--gray-11)' }}>
                    {story.steps.length} step{story.steps.length !== 1 ? 's' : ''}
                  </Tree.NodeLabel>
                </Tree.Node>
              </Tree.Children>
            )}
          </Tree.Node>
        ))}
        {stories.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-11)' }}>
            No stories yet. Create one to get started.
          </div>
        )}
      </Tree.Root>

      <Dialog
        title="New Story"
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        buttons={[
          {
            type: 'cancel',
            label: 'Cancel',
            onClick: () => setShowNewDialog(false)
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
    </ToolWindowPanel>
  );
};
