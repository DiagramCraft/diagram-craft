import { NumberInput } from './NumberInput';
import styles from './Slider.module.css';
import { extractDataAttributes, extractMouseEvents } from './utils';
import { Slider as BaseUISlider } from '@base-ui/react/slider';

export const Slider = (props: Props) => {
  return (
    <div className={styles.cmpSlider} {...extractMouseEvents(props)}>
      <BaseUISlider.Root
        defaultValue={props.value}
        value={props.value}
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        disabled={props.disabled || props.isIndeterminate}
        onValueChange={v => props.onChange(v)}
      >
        <BaseUISlider.Control className={styles.cmpSliderSlider}>
          <BaseUISlider.Track className={styles.cmpSliderTrack}>
            <BaseUISlider.Indicator className={styles.cmpSliderRange} />
            <BaseUISlider.Thumb
              className={styles.cmpSliderThumb}
              {...extractDataAttributes(props, ['thumb-hover', 'thumb-focus'])}
            />
          </BaseUISlider.Track>
        </BaseUISlider.Control>
      </BaseUISlider.Root>

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
