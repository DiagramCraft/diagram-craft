import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { FormGroup } from '../../../components/FormGroup';
import { IconPicker } from '../../../components/IconPicker';
import {
  resolveFrameStyle,
  WIDGET_FRAME_STYLES,
  WIDGET_TINTS,
  type WidgetFrameStyle
} from './widgetFrameSettings';
import styles from './WidgetFrameSettingsForm.module.css';

type Props = {
  frame: DashboardWidgetFrame;
  onChange: (frame: DashboardWidgetFrame) => void;
  defaultTitle: string;
};

/** Title, frame style, tint and icon settings shared by every dashboard widget. */
export const WidgetFrameSettingsForm = ({ frame, onChange, defaultTitle }: Props) => (
  <>
    <FormGroup label="Title" variant="simple">
      <TextInput
        value={frame.title ?? ''}
        placeholder={defaultTitle}
        style={{ width: '100%' }}
        onChange={value => onChange({ ...frame, title: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Frame" variant="simple">
      <ToggleButtonGroup.Root
        type="single"
        value={resolveFrameStyle(frame)}
        onChange={value => {
          if (value)
            onChange({
              ...frame,
              style: value as WidgetFrameStyle,
              showFrame: undefined
            });
        }}
      >
        {WIDGET_FRAME_STYLES.map(s => (
          <ToggleButtonGroup.Item key={s.value} value={s.value}>
            {s.label}
          </ToggleButtonGroup.Item>
        ))}
      </ToggleButtonGroup.Root>
    </FormGroup>
    <FormGroup label="Color" variant="simple">
      <div className={styles.swatches}>
        <ToggleButtonGroup.Root
          type="single"
          value={frame.tint ? undefined : 'none'}
          onChange={() => onChange({ ...frame, tint: undefined })}
        >
          <ToggleButtonGroup.Item value="none">None</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
        {WIDGET_TINTS.map(tint => (
          <button
            key={tint}
            type="button"
            className={styles.swatch}
            data-tint={tint}
            aria-label={tint}
            title={tint}
            aria-pressed={frame.tint === tint}
            onClick={() => onChange({ ...frame, tint })}
          />
        ))}
      </div>
    </FormGroup>
    <FormGroup label="Icon" variant="simple">
      <IconPicker
        value={frame.icon}
        noneLabel="Default"
        onChange={icon => onChange({ ...frame, icon })}
      />
    </FormGroup>
  </>
);
