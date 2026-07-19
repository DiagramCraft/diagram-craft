import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TbCheck } from 'react-icons/tb';
import type { NotificationChannel } from '@arch-register/api-types/notificationPreferencesContract';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from '../../hooks/useNotificationPreferences';
import { LoadingState } from '../../components/LoadingState';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from '../workspace-settings/sub-sections/GeneralSubSection.module.css';

const IN_APP_CHANNEL: NotificationChannel = 'in_app';
const EMAIL_CHANNEL: NotificationChannel = 'email';

export const NotificationPreferencesSubSection = () => {
  const ctx = useWorkspaceContext();
  const workspaceId = ctx.workspaceSlug;
  const { data, isLoading, error } = useNotificationPreferences(workspaceId);
  const updatePreferences = useUpdateNotificationPreferences(workspaceId);

  const [inAppByType, setInAppByType] = useState<Record<string, boolean>>({});
  const [emailByType, setEmailByType] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const savedPreferences = useMemo(() => {
    const entries: Record<string, boolean> = {};
    const emailEntries: Record<string, boolean> = {};
    for (const type of data?.notificationTypes ?? []) {
      const inAppPreference = data?.preferences.find(
        item => item.notificationType === type.notificationType && item.channel === IN_APP_CHANNEL
      );
      const emailPreference = data?.preferences.find(
        item => item.notificationType === type.notificationType && item.channel === EMAIL_CHANNEL
      );
      entries[type.notificationType] = inAppPreference?.enabled ?? false;
      emailEntries[type.notificationType] = emailPreference?.enabled ?? false;
    }
    return { inApp: entries, email: emailEntries };
  }, [data]);

  useEffect(() => {
    setInAppByType(savedPreferences.inApp);
    setEmailByType(savedPreferences.email);
  }, [savedPreferences]);

  const hasChanges = data?.notificationTypes.some(
    type =>
      inAppByType[type.notificationType] !== savedPreferences.inApp[type.notificationType] ||
      emailByType[type.notificationType] !== savedPreferences.email[type.notificationType]
  );

  const emailImplemented = data?.channels.some(
    channel => channel.channel === EMAIL_CHANNEL && channel.implemented
  );
  const notImplementedChannels = (data?.channels ?? []).filter(
    channel => !channel.implemented && channel.channel !== IN_APP_CHANNEL
  );

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updatePreferences.mutateAsync(
        data.notificationTypes.flatMap(type => [
          {
            notificationType: type.notificationType,
            channel: IN_APP_CHANNEL,
            enabled: inAppByType[type.notificationType] ?? false
          },
          ...(emailImplemented
            ? [
                {
                  notificationType: type.notificationType,
                  channel: EMAIL_CHANNEL,
                  enabled: emailByType[type.notificationType] ?? false
                }
              ]
            : [])
        ])
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div>Failed to load notification preferences: {error.message}</div>;
  if (isLoading || !data)
    return <LoadingState text="Loading notification preferences…" size="sm" />;

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button
          onClick={() => {
            setInAppByType(savedPreferences.inApp);
            setEmailByType(savedPreferences.email);
          }}
          disabled={!hasChanges || isSaving}
        >
          Reset
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            'Saving...'
          ) : saveSuccess ? (
            <>
              <TbCheck size={14} /> Saved
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Notification delivery</div>
          <div className={styles.sectionSub}>
            Choose which notification types deliver in-app or by email. Email delivery is
            asynchronous and may take a few minutes.
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.preferenceTable}>
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">In-app</th>
                {emailImplemented && <th scope="col">Email</th>}
              </tr>
            </thead>
            <tbody>
              {data.notificationTypes.map(type => (
                <tr key={type.notificationType}>
                  <th scope="row">
                    <div className={styles.fieldLabel}>
                      {type.label}
                      {type.category === 'reminder' && ' (reminder)'}
                    </div>
                    <div className={styles.fieldHint}>{type.description}</div>
                  </th>
                  <td>
                    <Checkbox
                      label="In-app"
                      value={inAppByType[type.notificationType] ?? false}
                      onChange={value =>
                        setInAppByType(current => ({
                          ...current,
                          [type.notificationType]: value ?? false
                        }))
                      }
                    />
                  </td>
                  {emailImplemented && (
                    <td>
                      <Checkbox
                        label="Email"
                        value={emailByType[type.notificationType] ?? false}
                        onChange={value =>
                          setEmailByType(current => ({
                            ...current,
                            [type.notificationType]: value ?? false
                          }))
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {notImplementedChannels.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Other channels</div>
            <div className={styles.sectionSub}>
              {notImplementedChannels.map(channel => channel.label).join(', ')} are planned but not
              yet available for any notification type.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
