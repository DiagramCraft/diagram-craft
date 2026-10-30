import styles from './NotificationPreferencesSubSection.module.css';
import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import type { NotificationChannel } from '@arch-register/api-types/notificationPreferencesContract';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from '../../hooks/useNotificationPreferences';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { SettingsBlock, SettingsBlockField } from '../workspace-settings/SettingsBlock';
import { QueryState } from '../workspace-settings/QueryState';
import { MutationError } from '../workspace-settings/MutationError';
import { SectionActions } from '../workspace-settings/SectionActions';
import { SaveBarButtons } from '../workspace-settings/SaveBarButtons';

const IN_APP_CHANNEL: NotificationChannel = 'in_app';
const EMAIL_CHANNEL: NotificationChannel = 'email';

export const NotificationPreferencesSubSection = () => {
  const ctx = useWorkspaceContext();
  const workspaceId = ctx.workspaceSlug;
  const { data, isLoading, error } = useNotificationPreferences(workspaceId);
  const updatePreferences = useUpdateNotificationPreferences(workspaceId);

  const [inAppByType, setInAppByType] = useState<Record<string, boolean>>({});
  const [emailByType, setEmailByType] = useState<Record<string, boolean>>({});

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

  const handleSave = async () => {
    if (!data) return;
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
    } catch {
      // The error is surfaced through the mutation state
    }
  };

  if (error || isLoading || !data)
    return (
      <QueryState isLoading={isLoading} error={error} subject="notification preferences">
        {null}
      </QueryState>
    );

  return (
    <>
      <SectionActions>
        <SaveBarButtons
          dirty={hasChanges ?? false}
          pending={updatePreferences.isPending}
          onCancel={() => {
            setInAppByType(savedPreferences.inApp);
            setEmailByType(savedPreferences.email);
          }}
          onSave={handleSave}
        />
      </SectionActions>

      <MutationError error={updatePreferences.error} />
      <SettingsBlock
        title="Notification delivery"
        description="Choose which notification types deliver in-app or by email. Email delivery is asynchronous and may take a few minutes."
      >
        {data.notificationTypes.map(type => (
          <SettingsBlockField
            key={type.notificationType}
            label={
              <>
                {type.label}
                {type.category === 'reminder' && ' (reminder)'}
              </>
            }
            hint={type.description}
          >
            <div className={styles.channels}>
              <div className={styles.channel}>
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
              </div>
              {emailImplemented && (
                <div className={styles.channel}>
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
                </div>
              )}
            </div>
          </SettingsBlockField>
        ))}
      </SettingsBlock>
    </>
  );
};
