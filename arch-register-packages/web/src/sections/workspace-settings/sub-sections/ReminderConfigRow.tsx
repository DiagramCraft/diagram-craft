import { useCallback, useEffect, useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './ReminderConfigRow.module.css';
import type { GovernanceReminderConfig } from '@arch-register/api-types/governanceReminderConfigContract';

const parseDayList = (value: string): number[] =>
  value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => Number(part))
    .filter(n => Number.isInteger(n) && n >= 0);

const formatDayList = (days: number[]): string => days.join(', ');

export const ReminderConfigRow = ({
  config,
  onSave,
  saving
}: {
  config: GovernanceReminderConfig;
  onSave: (data: {
    enabled: boolean;
    approaching_days: number[];
    overdue_days: number[];
    escalation_enabled: boolean;
  }) => void;
  saving: boolean;
}) => {
  const [enabled, setEnabled] = useState(config.enabled);
  const [approachingDays, setApproachingDays] = useState(formatDayList(config.approaching_days));
  const [overdueDays, setOverdueDays] = useState(formatDayList(config.overdue_days));
  const [escalationEnabled, setEscalationEnabled] = useState(config.escalation_enabled);

  useEffect(() => {
    setEnabled(config.enabled);
    setApproachingDays(formatDayList(config.approaching_days));
    setOverdueDays(formatDayList(config.overdue_days));
    setEscalationEnabled(config.escalation_enabled);
  }, [config]);

  const isDirty =
    enabled !== config.enabled ||
    approachingDays !== formatDayList(config.approaching_days) ||
    overdueDays !== formatDayList(config.overdue_days) ||
    escalationEnabled !== config.escalation_enabled;

  const handleSave = useCallback(() => {
    onSave({
      enabled,
      approaching_days: parseDayList(approachingDays),
      overdue_days: parseDayList(overdueDays),
      escalation_enabled: escalationEnabled
    });
  }, [enabled, approachingDays, overdueDays, escalationEnabled, onSave]);

  const handleCancel = () => {
    setEnabled(config.enabled);
    setApproachingDays(formatDayList(config.approaching_days));
    setOverdueDays(formatDayList(config.overdue_days));
    setEscalationEnabled(config.escalation_enabled);
  };

  return (
    <div className={styles.field}>
      <div className={styles.fieldLeft}>
        <div className={styles.fieldLabel}>{config.case_kind_label}</div>
        <div className={styles.fieldHint}>
          {config.is_default
            ? 'Using the built-in default cadence.'
            : 'Using a workspace-specific cadence.'}
        </div>
      </div>
      <div className={styles.fieldRight}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span style={{ fontSize: 12, color: 'var(--base-fg-dim)' }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
        <TextInput
          value={approachingDays}
          onChange={value => setApproachingDays(value ?? '')}
          placeholder="e.g. 2, 5"
          disabled={!enabled}
          style={{ maxWidth: 160 }}
        />
        <span style={{ fontSize: 11, color: 'var(--cmp-fg-disabled)' }}>days before due</span>
        <TextInput
          value={overdueDays}
          onChange={value => setOverdueDays(value ?? '')}
          placeholder="e.g. 1, 3"
          disabled={!enabled}
          style={{ maxWidth: 160 }}
        />
        <span style={{ fontSize: 11, color: 'var(--cmp-fg-disabled)' }}>days after due</span>
        {config.escalation_supported && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={escalationEnabled}
              onChange={e => setEscalationEnabled(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: 'var(--base-fg-dim)' }}>Escalate if overdue</span>
          </label>
        )}
        {isDirty && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <Button onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
