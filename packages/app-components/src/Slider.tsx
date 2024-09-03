import * as ReactSlider from '@radix-ui/react-slider';
import { NumberInput } from './NumberInput';
import styles from './Slider.module.css';
import { extractDataAttributes } from './utils';

export const Slider = (props: Props) => {
  return (
    <div className={styles.cmpSlider}>
      <ReactSlider.Root
        className={styles.cmpSliderSlider}
        defaultValue={[props.value]}
        value={[props.value]}
        max={props.max ?? 100}
        step={1}
        disabled={props.disabled}
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
        min={0}
        max={100}
        style={{ width: '50px' }}
        onChange={props.onChange}
        disabled={props.disabled}
        defaultValue={props.defaultValue}
        isDefaultValue={props.isDefaultValue}
      />
    </div>
  );
};

type Props = {
  value: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  defaultValue?: number;
  isDefaultValue?: boolean;
};
