import { TbSquare, TbTag, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  EntityDrawerCatalog,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import {
  AddMenu,
  type AvailableFields,
  type MetadataSlotId,
  type PickerGroup,
  type ProfileUpdater
} from './EntityDrawerEditorControls';
import layoutStyles from './SchemaLayoutEditor.module.css';
import styles from './EntityDrawerSettingsScreen.module.css';
import {
  updateEntityDrawerProfileBadge,
  updateEntityDrawerProfileBadges
} from './entityDrawerProfileUpdates';

type EntityDrawerBadgeEditorProps = {
  profile: EntityDrawerProfile;
  catalog: EntityDrawerCatalog;
  availableFields: AvailableFields;
  updateProfile: ProfileUpdater;
};

export const EntityDrawerBadgeEditor = ({
  profile,
  catalog,
  availableFields,
  updateProfile
}: EntityDrawerBadgeEditorProps) => {
  const badgeGroups: PickerGroup[] = [
    {
      label: '',
      options: [
        ...(availableFields.length > 0
          ? [
              {
                value: 'field',
                label: 'Field',
                pick: () => {
                  const field = availableFields[0]!;
                  updateProfile(
                    updateEntityDrawerProfileBadges(profile, badges => [
                      ...badges,
                      { kind: 'field', fieldId: field.id }
                    ])
                  );
                }
              }
            ]
          : []),
        ...(catalog.metadataSlots.length > 0
          ? [
              {
                value: 'metadata',
                label: 'Metadata',
                pick: () => {
                  const slot = catalog.metadataSlots[0]!;
                  updateProfile(
                    updateEntityDrawerProfileBadges(profile, badges => [
                      ...badges,
                      { kind: 'metadata', slot: slot.id }
                    ])
                  );
                }
              }
            ]
          : [])
      ]
    }
  ];
  const updateBadge = (
    index: number,
    updater: (
      badge: EntityDrawerProfile['header']['badges'][number]
    ) => EntityDrawerProfile['header']['badges'][number]
  ) => updateProfile(updateEntityDrawerProfileBadge(profile, index, updater));

  return (
    <div className={layoutStyles.panel}>
      <div className={layoutStyles.panelHead}>
        <span className={styles.panelTitle}>Header badges</span>
      </div>
      <div className={layoutStyles.blockList}>
        {profile.header.badges.length === 0 && (
          <div className={layoutStyles.emptyInline}>No header badges</div>
        )}
        {profile.header.badges.map((badge, index) => (
          <div key={`${badge.kind}-${index}`} className={layoutStyles.blockGroup}>
            <div className={layoutStyles.blockGroupRow}>
              <span className={layoutStyles.blockIcon}>
                {badge.kind === 'metadata' ? <TbTag size={11} /> : <TbSquare size={11} />}
              </span>
              <TextInput
                value={
                  badge.label ??
                  (badge.kind === 'metadata'
                    ? (catalog.metadataSlots.find(slot => slot.id === badge.slot)?.label ??
                      badge.slot)
                    : (availableFields.find(field => field.id === badge.fieldId)?.name ??
                      badge.fieldId))
                }
                onChange={value => {
                  updateBadge(index, current => ({
                    ...current,
                    label: value && value.trim() !== '' ? value : undefined
                  }));
                }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button
                variant="icon-only"
                size="xs"
                aria-label="Remove badge"
                onClick={() =>
                  updateProfile(
                    updateEntityDrawerProfileBadges(profile, badges =>
                      badges.filter((_, badgeIndex) => badgeIndex !== index)
                    )
                  )
                }
              >
                <TbTrash size={11} />
              </Button>
            </div>
            {badge.kind === 'field' && (
              <>
                <hr className={layoutStyles.blockGroupDivider} />
                <div className={styles.optionsEditor}>
                  <label>
                    <span>Field</span>
                    <Select.Root
                      value={badge.fieldId}
                      onChange={value => {
                        const field = availableFields.find(candidate => candidate.id === value);
                        if (!field) return;
                        updateBadge(index, entry =>
                          entry.kind === 'field' ? { ...entry, fieldId: field.id } : entry
                        );
                      }}
                    >
                      {availableFields.map(field => (
                        <Select.Item key={field.id} value={field.id}>
                          {field.name}
                        </Select.Item>
                      ))}
                    </Select.Root>
                  </label>
                </div>
              </>
            )}
            {badge.kind === 'metadata' && (
              <>
                <hr className={layoutStyles.blockGroupDivider} />
                <div className={styles.optionsEditor}>
                  <label>
                    <span>Metadata field</span>
                    <Select.Root
                      value={badge.slot}
                      onChange={value => {
                        if (!value) return;
                        const slot = value as MetadataSlotId;
                        updateBadge(index, entry =>
                          entry.kind === 'metadata' ? { ...entry, slot } : entry
                        );
                      }}
                    >
                      {catalog.metadataSlots.map(slot => (
                        <Select.Item key={slot.id} value={slot.id}>
                          {slot.label}
                        </Select.Item>
                      ))}
                    </Select.Root>
                  </label>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <AddMenu label="Add badge" groups={badgeGroups} />
    </div>
  );
};
