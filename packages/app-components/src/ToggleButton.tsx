import { ReactNode } from 'react';
import styles from './ToggleButtonGroup.module.css';
import { extractDataAttributes } from './utils';
import { Toggle as BaseUIToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseUIToggleGroup } from '@base-ui/react/toggle-group';

export const ToggleButton = (props: Props) => {
  return (
    <BaseUIToggleGroup
      multiple={false}
      value={[props.value.toString()]}
      onValueChange={value => props.onChange(value[0] === 'true')}
      className={styles.cmpToggleButtonGroup}
      disabled={props.disabled}
      {...extractDataAttributes(props)}
    >
      <BaseUIToggle
        className={styles.cmpToggleButtonGroupItem}
        value={'true'}
        {...extractDataAttributes(props)}
      >
        {props.children}
      </BaseUIToggle>
    </BaseUIToggleGroup>
  );
};

type Props = {
  children: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};
