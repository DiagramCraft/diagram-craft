import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  EntityDrawerConfiguration,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import {
  buildFallbackEntityDrawerProfile,
  normalizeLegacyEntityDrawerConfiguration
} from '@arch-register/api-types/entityDrawerConfiguration';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useEntityDrawerCatalog,
  useEntityDrawerConfiguration,
  useUpdateEntityDrawerConfiguration
} from '../../hooks/useWorkspaceConfig';
import layoutStyles from './SchemaLayoutEditor.module.css';
import styles from './EntityDrawerSettingsScreen.module.css';
import { EntityDrawerBadgeEditor } from './EntityDrawerBadgeEditor';
import { EntityDrawerSectionsEditor } from './EntityDrawerSectionsEditor';

const cloneProfile = (profile: EntityDrawerProfile): EntityDrawerProfile =>
  JSON.parse(JSON.stringify(profile)) as EntityDrawerProfile;

const validateLocalEntityDrawerDraft = (configuration: EntityDrawerConfiguration): string[] =>
  Object.entries(configuration.profiles).flatMap(([schemaId, profile]) =>
    profile.sections.flatMap(section =>
      section.items.flatMap(item => {
        if (item.kind !== 'query') return [];
        return (item.fields ?? []).flatMap(field =>
          field.fieldId.trim() === ''
            ? [
                `Schema '${schemaId}', section '${section.title}': query result fields require a field id.`
              ]
            : []
        );
      })
    )
  );

const SaveErrors = ({ errors }: { errors: string[] }) =>
  errors.length > 0 ? (
    <div className={styles.error} role="alert">
      {errors.map((error, index) => (
        <div key={`${error}-${index}`}>{error}</div>
      ))}
    </div>
  ) : null;

export const EntityDrawerEditor = ({
  schemaId,
  canEdit = true
}: {
  schemaId?: string;
  canEdit?: boolean;
}) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const selectedSchemaId = schemaId ?? schemas[0]?.id;
  const selectedSchema = schemas.find(schema => schema.id === selectedSchemaId) ?? schemas[0];
  const configurationQuery = useEntityDrawerConfiguration(workspaceSlug);
  const catalogQuery = useEntityDrawerCatalog(workspaceSlug);
  const update = useUpdateEntityDrawerConfiguration(workspaceSlug);
  const [draft, setDraft] = useState<EntityDrawerConfiguration | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  useEffect(() => {
    const stored = normalizeLegacyEntityDrawerConfiguration(
      configurationQuery.data?.stored_configuration
    );
    setDraft(
      stored && typeof stored === 'object' && 'version' in stored && stored.version === 1
        ? (JSON.parse(JSON.stringify(stored)) as EntityDrawerConfiguration)
        : { version: 1, profiles: {} }
    );
  }, [configurationQuery.data?.stored_configuration]);

  useEffect(() => {
    setCustomizing(Boolean(selectedSchemaId && draft?.profiles[selectedSchemaId]));
  }, [draft, selectedSchemaId]);

  const catalog = catalogQuery.data;
  const profile = useMemo(() => {
    if (!selectedSchemaId || !selectedSchema) return undefined;
    return (
      draft?.profiles[selectedSchemaId] ??
      configurationQuery.data?.effective_configuration.profiles[selectedSchemaId] ??
      buildFallbackEntityDrawerProfile(selectedSchema)
    );
  }, [
    configurationQuery.data?.effective_configuration.profiles,
    draft,
    selectedSchema,
    selectedSchemaId
  ]);

  if (!selectedSchema)
    return (
      <div className={styles.message}>Create an entity schema before configuring drawers.</div>
    );
  if (!catalog || !configurationQuery.data || !profile)
    return <div className={styles.message}>Loading entity drawer configuration…</div>;

  const updateProfile = (next: EntityDrawerProfile) => {
    if (!draft || !selectedSchemaId) return;
    update.reset();
    setLocalErrors([]);
    setDraft({ ...draft, profiles: { ...draft.profiles, [selectedSchemaId]: next } });
  };

  const startCustomizing = () => {
    if (!draft || !selectedSchemaId) return;
    setDraft({
      ...draft,
      profiles: { ...draft.profiles, [selectedSchemaId]: cloneProfile(profile) }
    });
    setCustomizing(true);
  };

  const disableCustomLayout = () => {
    if (!draft || !selectedSchemaId) return;
    const next = { ...draft, profiles: { ...draft.profiles } };
    delete next.profiles[selectedSchemaId];
    setDraft(next);
    setCustomizing(false);
  };

  const save = () => {
    if (!draft) return;
    const errors = validateLocalEntityDrawerDraft(draft);
    if (errors.length > 0) {
      update.reset();
      setLocalErrors(errors);
      return;
    }
    setLocalErrors([]);
    update.mutate(draft);
  };
  const saveErrors = [
    ...localErrors,
    ...(update.error instanceof Error
      ? [`Unable to save drawer configuration: ${update.error.message}`]
      : [])
  ];
  const availableFields =
    catalog.schemas
      .find(schema => schema.id === selectedSchemaId)
      ?.fields.filter(field => !field.archived) ?? [];
  const availableSlots = catalog.slots.filter(slot =>
    slot.supportedSchemaIds.includes(selectedSchema.id)
  );
  const availableChildren = catalog.schemas.flatMap(childSchema =>
    childSchema.fields
      .filter(
        field =>
          field.type === 'containment' && field.schemaId === selectedSchema.id && !field.archived
      )
      .map(field => ({ childSchema, field }))
  );
  const stored = configurationQuery.data.stored_configuration;
  const storedProfiles =
    stored &&
    typeof stored === 'object' &&
    'version' in stored &&
    stored.version === 1 &&
    'profiles' in stored &&
    typeof stored.profiles === 'object' &&
    stored.profiles !== null
      ? stored.profiles
      : undefined;
  const defaultChangePending = Boolean(
    selectedSchemaId &&
      storedProfiles &&
      selectedSchemaId in storedProfiles &&
      !draft?.profiles[selectedSchemaId]
  );

  if (!customizing)
    return (
      <div className={layoutStyles.off}>
        <div className={layoutStyles.offCopy}>
          <div className={layoutStyles.offTitle}>Using the default drawer layout</div>
          <div className={layoutStyles.offDesc}>
            Fields follow the schema order and field groups, followed by metadata. Application
            content appears when it is authored in a seeded, templated, or custom profile. The
            drawer stays read-only and keeps its standard responsive behavior.
          </div>
        </div>
        {canEdit && (
          <div className={styles.defaultActions}>
            {defaultChangePending && (
              <Button variant="secondary" onClick={save} disabled={update.isPending}>
                Save changes
              </Button>
            )}
            <Button variant="primary" onClick={startCustomizing}>
              Use a custom layout
            </Button>
          </div>
        )}
        <SaveErrors errors={saveErrors} />
      </div>
    );

  return (
    <>
      <label className={layoutStyles.toggle}>
        <input
          type="checkbox"
          className={layoutStyles.checkbox}
          disabled={!canEdit}
          checked
          onChange={event => {
            if (!event.target.checked) disableCustomLayout();
          }}
        />
        Use a custom layout for the entity drawer
      </label>

      <div className={styles.customHeader}>
        <div>
          <div className={layoutStyles.sectionLabel}>Entity drawer layout</div>
          <p className={styles.description}>
            Presentation only. Field-group and provider permissions are enforced when the drawer
            renders.
          </p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            Save changes
          </Button>
        )}
      </div>

      <SaveErrors errors={saveErrors} />

      {configurationQuery.data.diagnostics.length > 0 && (
        <div className={styles.warning} role="alert">
          <div>
            {configurationQuery.data.diagnostics.length} stale or invalid configuration entries are
            being omitted.
          </div>
          {configurationQuery.data.diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.code}-${diagnostic.itemId ?? index}`}>{diagnostic.message}</div>
          ))}
        </div>
      )}

      <fieldset disabled={!canEdit} className={styles.form}>
        <div className={layoutStyles.canvas}>
          <div className={layoutStyles.column}>
            <EntityDrawerBadgeEditor
              profile={profile}
              catalog={catalog}
              availableFields={availableFields}
              updateProfile={updateProfile}
            />

            <EntityDrawerSectionsEditor
              profile={profile}
              catalog={catalog}
              selectedSchema={selectedSchema}
              schemas={schemas}
              relationSchemas={relationSchemas}
              availableFields={availableFields}
              availableSlots={availableSlots}
              availableChildren={availableChildren}
              canEdit={canEdit}
              updateProfile={updateProfile}
            />
          </div>
        </div>
      </fieldset>
    </>
  );
};
