import { IconType } from 'react-icons/lib/cjs/iconBase';
import { $c } from '../utils/classname.ts';

export const ToolWindowButton = (props: Props) => {
  return (
    <div className={$c('cmp-tool-window-button', { selected: !!props.isSelected })}>
      <props.icon size={'1.3rem'} />
    </div>
  );
};

type Props = {
  icon: IconType;
  isSelected?: boolean;
};
