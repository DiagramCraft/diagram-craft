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

export const NotificationPreferencesSubSection = () => {
  const ctx = useWorkspaceContext();
  const workspaceId = ctx.workspaceSlug;
  const { data, isLoading, error } = useNotificationPreferences(workspaceId);
  const updatePreferences = useUpdateNotificationPreferences(workspaceId);

  const [inAppByType, setInAppByType] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const savedInAppByType = useMemo(() => {
    const entries: Record<string, boolean> = {};
    for (const type of data?.notificationTypes ?? []) {
      const preference = data?.preferences.find(
        item => item.notificationType === type.notificationType && item.channel === IN_APP_CHANNEL
      );
      entries[type.notificationType] = preference?.enabled ?? false;
    }
    return entries;
  }, [data]);

  useEffect(() => {
    setInAppByType(savedInAppByType);
  }, [savedInAppByType]);

  const hasChanges = data?.notificationTypes.some(
    type => inAppByType[type.notificationType] !== savedInAppByType[type.notificationType]
  );

  const notImplementedChannels = (data?.channels ?? []).filter(channel => !channel.implemented);

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updatePreferences.mutateAsync(
        data.notificationTypes.map(type => ({
          notificationType: type.notificationType,
          channel: IN_APP_CHANNEL,
          enabled: inAppByType[type.notificationType] ?? false
        }))
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div>Failed to load notification preferences: {error.message}</div>;
  if (isLoading || !data) return <LoadingState text="Loading notification preferences…" size="sm" />;

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button
          onClick={() => setInAppByType(savedInAppByType)}
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
          <div className={styles.sectionTitle}>In-app notifications</div>
          <div className={styles.sectionSub}>
            Choose which notification types deliver to your in-app inbox. Turning a type off does
            not affect other notification types.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {data.notificationTypes.map(type => (
            <div className={styles.field} key={type.notificationType}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>
                  {type.label}
                  {type.category === 'reminder' && ' (reminder)'}
                </div>
                <div className={styles.fieldHint}>{type.description}</div>
              </div>
              <div className={styles.fieldRight}>
                <Checkbox
                  label="In-app"
                  value={inAppByType[type.notificationType] ?? false}
                  onChange={value =>
                    setInAppByType(current => {
                      const next = { ...current };
                      next[type.notificationType] = value ?? false;
                      return next;
                    })
                  }
                />
              </div>
            </div>
          ))}
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
