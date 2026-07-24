import { TbEye, TbEyeDotted, TbEyeOff } from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import type { CommentVisibility } from '@diagram-craft/canvas/components/commentVisibility';

type CommentsVisibilityMenuProps = {
  visibility: CommentVisibility;
  onVisibilityChange: (visibility: CommentVisibility) => void;
};

const visibilityIcon = (visibility: CommentVisibility) => {
  if (visibility === 'none') return <TbEyeOff />;
  if (visibility === 'unresolved') return <TbEyeDotted />;
  return <TbEye />;
};

export const CommentsVisibilityMenu = ({
  visibility,
  onVisibilityChange
}: CommentsVisibilityMenuProps) => (
  <MenuButton.Root>
    <MenuButton.Trigger
      variant={'icon-only'}
      aria-label="Comment visibility"
      title="Comment visibility"
    >
      {visibilityIcon(visibility)}
    </MenuButton.Trigger>
    <MenuButton.Menu>
      <Menu.RadioGroup value={visibility}>
        <Menu.RadioItem value={'all'} onClick={() => onVisibilityChange('all')}>
          All comments
        </Menu.RadioItem>
        <Menu.RadioItem value={'unresolved'} onClick={() => onVisibilityChange('unresolved')}>
          Unresolved comments
        </Menu.RadioItem>
        <Menu.RadioItem value={'none'} onClick={() => onVisibilityChange('none')}>
          No comments
        </Menu.RadioItem>
      </Menu.RadioGroup>
    </MenuButton.Menu>
  </MenuButton.Root>
);
