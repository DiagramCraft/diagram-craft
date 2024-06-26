import { IconType } from 'react-icons/lib/cjs/iconBase';

export const ToolWindowButton = (props: Props) => {
  return (
    <button
      className={'cmp-toolbar__toggle-item'}
      onClick={props.onClick}
      data-state={props.isSelected ? 'on' : 'off'}
    >
      <props.icon size={'16px'} />
    </button>
  );
};

type Props = {
  icon: IconType;
  isSelected?: boolean;
  onClick?: () => void;
};
