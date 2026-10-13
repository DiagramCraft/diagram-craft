import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { IconPicker } from '../../../components/IconPicker';
import styles from '../WidgetConfigDialog.module.css';

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
  <div className={styles.options}>
    <DialogSection label="Title">
      <div className={styles.titleRow}>
        <input
          className={styles.labelInput}
          value={frame.title ?? ''}
          placeholder={defaultTitle}
          onChange={e => onChange({ ...frame, title: e.target.value })}
        />
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={frame.showFrame ?? defaultShowFrame}
            onChange={e => onChange({ ...frame, showFrame: e.target.checked })}
          />
          <span className={styles.optionLabel}>Show frame</span>
        </label>
      </div>
    </DialogSection>
    <DialogSection label="Icon">
      <IconPicker
        value={frame.icon}
        noneLabel="Default"
        onChange={icon => onChange({ ...frame, icon })}
      />
    </DialogSection>
  </div>
);
