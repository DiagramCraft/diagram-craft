import { Menu } from '@diagram-craft/app-components/Menu';
import { useDiagram } from '../../application';
import {
  CreateGuideUndoableAction,
  DEFAULT_GUIDE_COLOR,
  DeleteGuideUndoableAction,
  EditGuideUndoableAction
} from '@diagram-craft/model/guides';
import type { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { newid } from '@diagram-craft/utils/id';
import { $t, $tStr, TranslatedString } from '@diagram-craft/utils/localize';

const GUIDE_COLORS: { label: TranslatedString; value: string }[] = [
  { label: $tStr('context.guide.color_default', 'Default'), value: DEFAULT_GUIDE_COLOR },
  { label: $tStr('context.guide.color_red', 'Red'), value: '#e5484d' },
  { label: $tStr('context.guide.color_blue', 'Blue'), value: '#0090ff' },
  { label: $tStr('context.guide.color_green', 'Green'), value: '#30a46c' },
  { label: $tStr('context.guide.color_orange', 'Orange'), value: '#f76b15' },
  { label: $tStr('context.guide.color_purple', 'Purple'), value: '#8e4ec6' }
];

const ColorSwatch = ({ color }: { color: string }) => (
  <div
    style={{
      width: '12px',
      height: '12px',
      borderRadius: '2px',
      backgroundColor: color,
      border: '1px solid rgba(0,0,0,0.2)',
      flexShrink: 0
    }}
  />
);

export const GuideContextMenu = (props: Props) => {
  const diagram = useDiagram();
  const guide = diagram.guides.find(g => g.id === props.target.guideId);

  if (!guide) return null;

  const handleDelete = () => {
    diagram.undoManager.addAndExecute(new DeleteGuideUndoableAction(diagram, guide));
  };

  const handleClone = () => {
    const cloned = {
      id: newid(),
      type: guide.type,
      position: guide.position + 50,
      color: guide.color
    };
    diagram.undoManager.addAndExecute(new CreateGuideUndoableAction(diagram, cloned));
  };

  const handleSetColor = (color: string) => {
    diagram.undoManager.addAndExecute(
      new EditGuideUndoableAction(diagram, guide, { color: guide.color }, { color })
    );
  };

  const handleToggleOrientation = () => {
    const newType = guide.type === 'horizontal' ? 'vertical' : 'horizontal';
    diagram.undoManager.addAndExecute(
      new EditGuideUndoableAction(diagram, guide, { type: guide.type }, { type: newType })
    );
  };

  return (
    <>
      <Menu.Item onClick={handleDelete}>{$t('context.guide.delete', 'Delete')}</Menu.Item>
      <Menu.Item onClick={handleClone}>{$t('context.guide.clone', 'Clone')}</Menu.Item>
      <Menu.SubMenu label={$t('context.guide.color', 'Color')}>
        {GUIDE_COLORS.map(({ label, value }) => (
          <Menu.Item
            key={value}
            onClick={() => handleSetColor(value)}
            leftSlot={<ColorSwatch color={value} />}
          >
            {$t(label)}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
      <Menu.Item onClick={handleToggleOrientation}>
        {$t('context.guide.toggle_orientation', 'Toggle orientation')}
      </Menu.Item>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'guide'>;
};
