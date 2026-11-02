import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ColorPicker } from './ColorPicker';
import styles from './UserDialog.module.css';

export type UserFormValues = {
  userId: string;
  email: string;
  displayName: string;
  password: string;
  isActive: boolean;
  color: string | null;
};

export const emptyUserFormValues: UserFormValues = {
  userId: '',
  email: '',
  displayName: '',
  password: '',
  isActive: true,
  color: null
};

export const normalizeEmail = (email: string) => {
  const trimmed = email.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const UserFormFields = ({
  values,
  onChange,
  isEditing = false,
  isSaving = false,
  isCurrentUser = false,
  authProvider = 'local'
}: {
  values: UserFormValues;
  onChange: (patch: Partial<UserFormValues>) => void;
  isEditing?: boolean;
  isSaving?: boolean;
  isCurrentUser?: boolean;
  authProvider?: string;
}) => {
  const passwordAvailable = !isEditing || authProvider === 'local';

  return (
    <div className={styles.body}>
      <div className={styles.fieldGrid}>
        <FormElement
          label="Username"
          hint={
            isEditing
              ? 'The username cannot be changed.'
              : 'Used to sign in with local authentication.'
          }
        >
          <TextInput
            value={values.userId}
            onChange={value => onChange({ userId: value ?? '' })}
            placeholder="jane.doe"
            autoFocus={!isEditing}
            disabled={isEditing || isSaving}
          />
        </FormElement>

        <FormElement label="Display name">
          <TextInput
            value={values.displayName}
            onChange={value => onChange({ displayName: value ?? '' })}
            placeholder="Jane Doe"
            autoFocus={isEditing}
            disabled={isSaving}
          />
        </FormElement>

        <FormElement label="Email" required={false}>
          <TextInput
            value={values.email}
            onChange={value => onChange({ email: value ?? '' })}
            placeholder="jane@example.com"
            type="email"
            disabled={isSaving}
          />
        </FormElement>

        <FormElement label="Authentication provider">
          <TextInput value={authProvider} onChange={() => {}} disabled />
        </FormElement>

        {passwordAvailable ? (
          <FormElement
            label={isEditing ? 'Reset password' : 'Password'}
            required={!isEditing}
            hint={isEditing ? 'Leave blank to keep the current password.' : undefined}
          >
            <TextInput
              value={values.password}
              onChange={value => onChange({ password: value ?? '' })}
              placeholder={isEditing ? 'Leave blank to keep current password' : 'Password'}
              type="password"
              disabled={isSaving}
            />
          </FormElement>
        ) : (
          <div className={styles.providerNote}>
            This account is managed by OIDC and does not have a local password.
          </div>
        )}
      </div>

      <div className={styles.activeRow}>
        <label>
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={event => onChange({ isActive: event.target.checked })}
            disabled={isSaving || isCurrentUser}
          />
          <span>Account is active</span>
        </label>
        {isCurrentUser && <span className={styles.hint}>Your own account cannot be deactivated.</span>}
      </div>

      <FormElement label="Avatar color" required={false}>
        <ColorPicker
          value={values.color}
          onChange={color => onChange({ color })}
          disabled={isSaving}
          size="small"
        />
      </FormElement>
    </div>
  );
};
