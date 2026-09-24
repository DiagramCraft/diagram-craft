import { useState, useCallback } from 'react';
import styles from './GeneralSubSection.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ColorPicker } from '../../../components/ColorPicker';
import { useUpdateWorkspace } from '../../../hooks/useWorkspaces';
import {
  Workspace,
  WorkspaceDateFormat,
  WorkspaceTimeFormat
} from '@arch-register/api-types/workspaceContract';
import {
  WORKSPACE_DATE_FORMATS,
  WORKSPACE_TIME_FORMATS,
  formatDateTime
} from '../../../utils/dateFormat';

const DATE_FORMAT_LABELS: Record<WorkspaceDateFormat, string> = {
  iso: 'ISO (2026-09-23)',
  'month-name': 'Month name (September 23, 2026)',
  'md-slash': 'Month/day (09/23/2026)',
  'dmy-slash': 'Day/month (23/09/2026)',
  'dmy-dot': 'Day.month.year (23.09.2026)'
};

const TIME_FORMAT_LABELS: Record<WorkspaceTimeFormat, string> = {
  '12h': '12-hour (2:05 PM)',
  '24h': '24-hour (14:05)'
};

export const GeneralSubSection = ({ workspace }: { workspace: Workspace }) => {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.url_slug);
  const [shortCode, setShortCode] = useState(workspace.short_code);
  const [color, setColor] = useState(workspace.color ?? '');
  const [description, setDescription] = useState(workspace.description);
  const [dateFormat, setDateFormat] = useState<WorkspaceDateFormat>(workspace.date_format);
  const [timeFormat, setTimeFormat] = useState<WorkspaceTimeFormat>(workspace.time_format);

  const updateWorkspaceMutation = useUpdateWorkspace();

  const isDirty =
    name !== workspace.name ||
    slug !== workspace.url_slug ||
    shortCode !== workspace.short_code ||
    color !== (workspace.color ?? '') ||
    description !== workspace.description ||
    dateFormat !== workspace.date_format ||
    timeFormat !== workspace.time_format;

  const handleSave = useCallback(async () => {
    try {
      await updateWorkspaceMutation.mutateAsync({
        workspaceId: workspace.id,
        data: {
          name,
          url_slug: slug,
          short_code: shortCode,
          color,
          description,
          date_format: dateFormat,
          time_format: timeFormat
        }
      });
    } catch {
      // Error handling could be improved
    }
  }, [
    workspace.id,
    name,
    slug,
    shortCode,
    color,
    description,
    dateFormat,
    timeFormat,
    updateWorkspaceMutation
  ]);

  const handleCancel = () => {
    setName(workspace.name);
    setSlug(workspace.url_slug);
    setShortCode(workspace.short_code);
    setColor(workspace.color ?? '');
    setDescription(workspace.description);
    setDateFormat(workspace.date_format);
    setTimeFormat(workspace.time_format);
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button onClick={handleCancel} disabled={!isDirty}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || updateWorkspaceMutation.isPending}
        >
          {updateWorkspaceMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Identity</div>
          <div className={styles.sectionSub}>How this workspace appears to members.</div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Workspace name</div>
              <div className={styles.fieldHint}>
                Shown in the top-left switcher and on shared links.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={name}
                onChange={value => setName(value ?? '')}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>URL slug</div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={slug}
                onChange={value => setSlug(value ?? '')}
                style={{ maxWidth: 340 }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Short code</div>
              <div className={styles.fieldHint}>
                Two-letter badge used in tight UI like the switcher.
              </div>
            </div>
            <div className={styles.fieldRight}>
              <TextInput
                value={shortCode}
                onChange={value => setShortCode((value ?? '').toUpperCase().slice(0, 2))}
                style={{ width: 80, fontFamily: 'var(--mono)' }}
                maxLength={2}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Color</div>
              <div className={styles.fieldHint}>Badge accent color in the workspace switcher.</div>
            </div>
            <div className={styles.fieldRight}>
              <ColorPicker
                value={color}
                onChange={v => setColor(v ?? SCHEMA_COLORS[0]!)}
                size="small"
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Description</div>
            </div>
            <div className={styles.fieldRight}>
              <TextArea
                value={description}
                onChange={value => setDescription(value ?? '')}
                rows={5}
                style={{ maxWidth: 540 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Date &amp; time format</div>
          <div className={styles.sectionSub}>
            How dates and times are displayed throughout this workspace.
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Date format</div>
            </div>
            <div className={styles.fieldRight}>
              <Select.Root
                value={dateFormat}
                onChange={value => setDateFormat((value as WorkspaceDateFormat) ?? dateFormat)}
              >
                {WORKSPACE_DATE_FORMATS.map(preset => (
                  <Select.Item key={preset} value={preset}>
                    {DATE_FORMAT_LABELS[preset]}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Time format</div>
            </div>
            <div className={styles.fieldRight}>
              <Select.Root
                value={timeFormat}
                onChange={value => setTimeFormat((value as WorkspaceTimeFormat) ?? timeFormat)}
              >
                {WORKSPACE_TIME_FORMATS.map(preset => (
                  <Select.Item key={preset} value={preset}>
                    {TIME_FORMAT_LABELS[preset]}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Preview</div>
              <div className={styles.fieldHint}>
                How the current date and time render with these settings.
              </div>
            </div>
            <div className={styles.fieldRight}>
              {formatDateTime(new Date(), '—', {
                date_format: dateFormat,
                time_format: timeFormat
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
