import { ReactNode } from 'react';
import * as ReactToolbar from '@radix-ui/react-toolbar';

export const ToggleButton = (props: Props) => {
  return (
    <ReactToolbar.Root className="cmp-toolbar">
      <ReactToolbar.ToggleGroup
        type={'single'}
        value={props.value.toString()}
        onValueChange={value => {
          props.onChange(value === 'true');
        }}
      >
        <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'true'}>
          {props.children}
        </ReactToolbar.ToggleItem>
      </ReactToolbar.ToggleGroup>
    </ReactToolbar.Root>
  );
};

type Props = {
  children: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
};
