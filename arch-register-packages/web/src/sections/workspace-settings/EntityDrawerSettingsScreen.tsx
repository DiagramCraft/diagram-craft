import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import type { EntityDrawerProfile } from '@arch-register/api-types/entityDrawerConfiguration';
import { buildFallbackEntityDrawerProfile } from '@arch-register/api-types/entityDrawerConfiguration';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useEntityDrawerCatalog } from '../../hooks/useWorkspaceConfig';
import { useEntityDrawerDraftContext } from './entityDrawerDraftContext';
import layoutStyles from './SchemaLayoutEditor.module.css';
import styles from './EntityDrawerSettingsScreen.module.css';
import { EntityDrawerBadgeEditor } from './EntityDrawerBadgeEditor';
import { EntityDrawerSectionsEditor } from './EntityDrawerSectionsEditor';
import { FormGroup } from '../../components/FormGroup';

const cloneProfile = (profile: EntityDrawerProfile): EntityDrawerProfile =>
  JSON.parse(JSON.stringify(profile)) as EntityDrawerProfile;

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
  const { configurationQuery, draft, edit, validationErrors, saveError } =
    useEntityDrawerDraftContext();
  const catalogQuery = useEntityDrawerCatalog(workspaceSlug);
  const [customizing, setCustomizing] = useState(false);

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
    edit({ ...draft, profiles: { ...draft.profiles, [selectedSchemaId]: next } });
  };

  const startCustomizing = () => {
    if (!draft || !selectedSchemaId) return;
    edit({
      ...draft,
      profiles: { ...draft.profiles, [selectedSchemaId]: cloneProfile(profile) }
    });
    setCustomizing(true);
  };

  const disableCustomLayout = () => {
    if (!draft || !selectedSchemaId) return;
    const next = { ...draft, profiles: { ...draft.profiles } };
    delete next.profiles[selectedSchemaId];
    edit(next);
    setCustomizing(false);
  };

  const saveErrors = [
    ...validationErrors,
    ...(saveError ? [`Unable to save drawer configuration: ${saveError}`] : [])
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
            <Button variant="primary" onClick={startCustomizing}>
              Use a custom layout
            </Button>
          </div>
        )}
        <SaveErrors errors={saveErrors} />
      </div>
    );

  return (
    <FormGroup
      variant={'section'}
      label={'Entity drawer layout'}
      action={
        <Button size={'xs'} onClick={disableCustomLayout}>
          Reset to default
        </Button>
      }
    >
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
    </FormGroup>
  );
};
