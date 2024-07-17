import { ReactNode } from 'react';
import * as ReactToggleGroup from '@radix-ui/react-toggle-group';
import styles from './ToggleButtonGroup.module.css';
import { extractDataAttributes } from './utils';

export const ToggleButton = (props: Props) => {
  return (
    <ReactToggleGroup.ToggleGroup
      type={'single'}
      value={props.value.toString()}
      onValueChange={value => {
        props.onChange(value === 'true');
      }}
      className={styles.root}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
    >
      <ReactToggleGroup.Item
        className={styles.item}
        value={'true'}
        {...extractDataAttributes(props)}
      >
        {props.children}
      </ReactToggleGroup.Item>
    </ReactToggleGroup.ToggleGroup>
  );
};

type Props = {
  children: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};
