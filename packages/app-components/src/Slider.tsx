import * as ReactSlider from '@radix-ui/react-slider';
import { NumberInput } from './NumberInput';
import styles from './Slider.module.css';
import { extractDataAttributes, extractMouseEvents } from './utils';

export const Slider = (props: Props) => {
  return (
    <div className={styles.cmpSlider} {...extractMouseEvents(props)}>
      <ReactSlider.Root
        className={styles.cmpSliderSlider}
        defaultValue={[props.value]}
        value={[props.value]}
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        disabled={props.disabled || props.isIndeterminate}
        onValueChange={v => props.onChange(v[0])}
      >
        <ReactSlider.Track className={styles.cmpSliderTrack}>
          <ReactSlider.Range className={styles.cmpSliderRange} />
        </ReactSlider.Track>
        <ReactSlider.Thumb
          className={styles.cmpSliderThumb}
          {...extractDataAttributes(props, ['thumb-hover', 'thumb-focus'])}
        />
      </ReactSlider.Root>

      <NumberInput
        defaultUnit={props.unit ?? '%'}
        value={props.value}
        min={props.min ?? 0}
        max={props.max ?? 100}
        style={{ width: '50px' }}
        state={props.state}
        onChange={props.onChange}
        disabled={props.disabled}
        isIndeterminate={props.isIndeterminate}
      />
    </div>
  );
};

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
  onChange: (value: number | undefined) => void;
};
