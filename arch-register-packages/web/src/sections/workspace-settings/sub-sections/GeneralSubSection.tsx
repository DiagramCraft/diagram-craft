import { useState, useCallback } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { SettingsBlock, SettingsBlockField, SettingsBlockList } from '../SettingsBlock';
import { WorkspaceSettingsSectionHeader } from '../WorkspaceSettingsSectionHeader';
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
    <>
      <WorkspaceSettingsSectionHeader
        section="general"
        buttons={
          <>
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
          </>
        }
      />
      <SettingsBlockList>
        <SettingsBlock title="Identity" description="How this workspace appears to members.">
          <SettingsBlockField
            label="Workspace name"
            hint="Shown in the top-left switcher and on shared links."
          >
            <TextInput
              value={name}
              onChange={value => setName(value ?? '')}
              style={{ maxWidth: 340 }}
            />
          </SettingsBlockField>

          <SettingsBlockField label="URL slug">
            <TextInput
              value={slug}
              onChange={value => setSlug(value ?? '')}
              style={{ maxWidth: 340 }}
            />
          </SettingsBlockField>

          <SettingsBlockField
            label="Short code"
            hint="Two-letter badge used in tight UI like the switcher."
          >
            <TextInput
              value={shortCode}
              onChange={value => setShortCode((value ?? '').toUpperCase().slice(0, 2))}
              style={{ width: 80, fontFamily: 'var(--mono)' }}
              maxLength={2}
            />
          </SettingsBlockField>

          <SettingsBlockField label="Color" hint="Badge accent color in the workspace switcher.">
            <ColorPicker
              value={color}
              onChange={v => setColor(v ?? SCHEMA_COLORS[0]!)}
              size="small"
            />
          </SettingsBlockField>

          <SettingsBlockField label="Description" align="top">
            <TextArea
              value={description}
              onChange={value => setDescription(value ?? '')}
              rows={5}
              style={{ maxWidth: 540 }}
            />
          </SettingsBlockField>
        </SettingsBlock>

        <SettingsBlock
          title="Date & time format"
          description="How dates and times are displayed throughout this workspace."
        >
          <SettingsBlockField label="Date format">
            <Select.Root
              value={dateFormat}
              onChange={value => setDateFormat((value as WorkspaceDateFormat) ?? dateFormat)}
              style={{ width: '340px' }}
            >
              {WORKSPACE_DATE_FORMATS.map(preset => (
                <Select.Item key={preset} value={preset}>
                  {DATE_FORMAT_LABELS[preset]}
                </Select.Item>
              ))}
            </Select.Root>
          </SettingsBlockField>

          <SettingsBlockField label="Time format">
            <Select.Root
              value={timeFormat}
              onChange={value => setTimeFormat((value as WorkspaceTimeFormat) ?? timeFormat)}
              style={{ width: '340px' }}
            >
              {WORKSPACE_TIME_FORMATS.map(preset => (
                <Select.Item key={preset} value={preset}>
                  {TIME_FORMAT_LABELS[preset]}
                </Select.Item>
              ))}
            </Select.Root>
          </SettingsBlockField>

          <SettingsBlockField
            label="Preview"
            hint="How the current date and time render with these settings."
          >
            {formatDateTime(new Date(), '—', {
              date_format: dateFormat,
              time_format: timeFormat
            })}
          </SettingsBlockField>
        </SettingsBlock>
      </SettingsBlockList>
    </>
  );
};
