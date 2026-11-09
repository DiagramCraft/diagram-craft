import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { FormGroup } from '../../../components/FormGroup';
import { IconPicker } from '../../../components/IconPicker';
import {
  resolveFrameStyle,
  WIDGET_FRAME_STYLES,
  WIDGET_TINTS,
  type WidgetFrameStyle,
  type WidgetTint
} from './widgetFrameSettings';
import { ColorPicker, type ColorOption } from '../../../components/ColorPicker';

const TINT_OPTIONS: ColorOption[] = WIDGET_TINTS.map(tint => ({
  value: tint,
  label: tint,
  swatch: `var(--${tint}-3)`
}));

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
      <ColorPicker
        size="small"
        noneLabel="None"
        value={frame.tint}
        colors={TINT_OPTIONS}
        onChange={tint => onChange({ ...frame, tint: (tint as WidgetTint | null) ?? undefined })}
      />
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
