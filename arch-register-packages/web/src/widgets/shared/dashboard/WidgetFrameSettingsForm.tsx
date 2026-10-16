import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { IconPicker } from '../../../components/IconPicker';

type Props = {
  frame: DashboardWidgetFrame;
  onChange: (frame: DashboardWidgetFrame) => void;
  defaultTitle: string;
  defaultShowFrame: boolean;
};

/** Title, frame visibility and icon settings shared by every dashboard widget. */
export const WidgetFrameSettingsForm = ({
  frame,
  onChange,
  defaultTitle,
  defaultShowFrame
}: Props) => (
  <>
    <FormGroup label="Title" variant="simple">
      <TextInput
        value={frame.title ?? ''}
        placeholder={defaultTitle}
        style={{ width: '100%' }}
        onChange={value => onChange({ ...frame, title: value ?? '' })}
      />
      <FormCheckboxList>
        <FormCheckboxList.Row label="Show frame">
          <input
            type="checkbox"
            checked={frame.showFrame ?? defaultShowFrame}
            onChange={e => onChange({ ...frame, showFrame: e.target.checked })}
          />
        </FormCheckboxList.Row>
      </FormCheckboxList>
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
