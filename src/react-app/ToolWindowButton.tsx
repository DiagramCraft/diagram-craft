import { IconType } from 'react-icons/lib/cjs/iconBase';

export const ToolWindowButton = (props: Props) => {
  return (
    <button
      className={'ToolbarToggleItem'}
      onClick={props.onClick}
      data-state={props.isSelected ? 'on' : 'off'}
    >
      <props.icon size={'1rem'} />
    </button>
  );
};

type Props = {
  icon: IconType;
  isSelected?: boolean;
  onClick?: () => void;
};
