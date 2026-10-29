import type { Ref } from 'react';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { PROJECT_STATUS_OPTIONS, type ProjectStatus } from '../lib/projectStatus';
import { Banner } from './Banner';
import { ColorPicker } from './ColorPicker';
import styles from './ProjectFormFields.module.css';

export type ProjectFormValues = {
  name: string;
  description: string;
  /** Team id, or '' for no owner */
  owner: string;
  status: ProjectStatus;
  color: string | null;
  startDate: string;
  targetDate: string;
};

export const EMPTY_PROJECT_FORM_VALUES: ProjectFormValues = {
  name: '',
  description: '',
  owner: '',
  status: 'active',
  color: null,
  startDate: '',
  targetDate: ''
};

/** Request body shared by project create and update. */
export const toProjectRequestBody = (values: ProjectFormValues) => ({
  name: values.name.trim(),
  description: values.description.trim(),
  owner: values.owner || null,
  status: values.status,
  color: values.color,
  start_date: values.startDate || null,
  target_date: values.targetDate || null
});

const FULL_WIDTH = { width: '100%' };

export const ProjectFormFields = ({
  values,
  onChange,
  onSubmit,
  error,
  owners,
  allowNoOwner,
  nameRef
}: {
  values: ProjectFormValues;
  onChange: (values: ProjectFormValues) => void;
  /** Called when the user presses Enter in a field */
  onSubmit: () => void;
  error?: string;
  /** Teams that can be picked as owner */
  owners: WorkspaceTeam[];
  allowNoOwner: boolean;
  nameRef?: Ref<HTMLInputElement>;
}) => {
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <form
      className={styles.fields}
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <button type="submit" hidden />
      <FormElement label="Name" required>
        <TextInput
          ref={nameRef}
          value={values.name}
          onChange={value => set('name', value ?? '')}
          placeholder="e.g. Checkout Modernization"
          style={FULL_WIDTH}
        />
      </FormElement>
      <FormElement label="Description" required={false}>
        <TextArea
          value={values.description}
          onChange={value => set('description', value ?? '')}
          placeholder="What is this project about?"
          rows={3}
          style={FULL_WIDTH}
        />
      </FormElement>
      <FormElement label="Status" required>
        <Select.Root
          value={values.status}
          onChange={value => set('status', (value as ProjectStatus | undefined) ?? 'active')}
          style={FULL_WIDTH}
        >
          {PROJECT_STATUS_OPTIONS.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Owner" required={false}>
        <Select.Root
          value={values.owner}
          onChange={value => set('owner', value ?? '')}
          placeholder={allowNoOwner ? 'No owner' : 'Select owner'}
          style={FULL_WIDTH}
        >
          {allowNoOwner && <Select.Item value="">No owner</Select.Item>}
          {owners.map(team => (
            <Select.Item key={team.id} value={team.id}>
              {team.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Color" required={false}>
        <ColorPicker value={values.color} onChange={color => set('color', color)} size="small" />
      </FormElement>
      <div style={{ display: 'flex', gap: 10 }}>
        <FormElement label="Start date" required={false} style={{ flex: 1 }}>
          <DateInput
            value={values.startDate}
            onChange={value => set('startDate', value ?? '')}
            style={FULL_WIDTH}
          />
        </FormElement>
        <FormElement label="Target date" required={false} style={{ flex: 1 }}>
          <DateInput
            value={values.targetDate}
            onChange={value => set('targetDate', value ?? '')}
            style={FULL_WIDTH}
          />
        </FormElement>
      </div>
      {error && <Banner variant="error">{error}</Banner>}
    </form>
  );
};
