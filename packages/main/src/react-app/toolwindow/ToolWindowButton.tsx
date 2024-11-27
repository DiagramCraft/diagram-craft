import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { IconType } from 'react-icons';

export const ToolWindowButton = (props: Props) => {
  return (
    <Toolbar.ToggleItem
      value={'tool'}
      onClick={props.onClick}
      data-state={props.isSelected ? 'on' : 'off'}
    >
      <props.icon size={'16px'} />
    </Toolbar.ToggleItem>
  );
};

type Props = {
  icon: IconType;
  isSelected?: boolean;
  onClick?: () => void;
};
