import { useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCode, TbPlus } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { EnumEditorScreen } from './EnumEditorScreen';
import { FieldGroupEditorScreen } from './FieldGroupEditorScreen';
import { RelationSchemaSettingsScreen } from './RelationSchemaSettingsScreen';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { useSchemaVersions } from '../../hooks/useSchemas';
import { useEntitySchemaAdapter } from './entitySchemaAdapter';
import { SchemaEditorForm } from './SchemaEditorForm';
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import { SchemaEditorProvider } from './schemaEditorContext';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { SchemaEditorScreenShell } from './SchemaEditorScreenShell';
import { useSchemaEditorController } from './schemaEditorState';

export const NEW_SCHEMA_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const SchemaSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedSchemaId = search.schema;
  const isNew = selectedSchemaId === NEW_SCHEMA_ID;
  const activeTab = search.tab ?? 'types';
  const { workspaceSlug, schemas, enums, fieldGroups = [], permissions } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const selectedIndex = schemas.findIndex(schema => schema.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? (schemas[selectedIndex] ?? null) : null;

  const onSelectSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { schema: id || undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const { adapter, isSaving } = useEntitySchemaAdapter(workspaceSlug);
  const editor = useSchemaEditorController({
    selected,
    isNew,
    items: schemas,
    fieldGroups,
    firstEnumId: enums[0]?.id,
    adapter,
    onSelect: onSelectSchema
  });
  const draft = editor.draft;

  const { data: schemaVersions, isLoading: schemaVersionsLoading } = useSchemaVersions(
    workspaceSlug,
    editor.showHistory && selected ? (selectedSchemaId ?? null) : null
  );

  if (activeTab === 'enums') return <EnumEditorScreen />;
  if (activeTab === 'fieldgroups') return <FieldGroupEditorScreen />;
  if (activeTab === 'relation-types') return <RelationSchemaSettingsScreen />;

  return (
    <SchemaEditorProvider editor={editor}>
      <SchemaEditorScreenShell
        hasSelection={Boolean((selected || isNew) && draft)}
        breadcrumb={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Settings' }
        ]}
        eyebrow="Entity"
        buttons={
          canEdit && draft ? (
            <EditorSaveButtons
              canSave={editor.dirty && Boolean(adapter.isValid?.(draft))}
              dirty={editor.dirty}
              onCancel={editor.revert}
              pending={isSaving}
              onSave={() => void editor.save()}
            />
          ) : undefined
        }
        menu={
          canEdit && selected ? (
            <EditorActionsMenu
              deleteLabel="Delete type"
              onDelete={() => editor.setConfirmDelete(true)}
            />
          ) : undefined
        }
        titleTestId="schema-editor-title"
        icon={
          (selected || isNew) && draft ? (
            <TypeBadge
              color={
                draft.color ??
                (selected ? resolveSchemaColor(selected, selectedIndex) : 'var(--base-fg-dim)')
              }
              name={selected?.name ?? draft.name}
              icon={draft.icon}
              size={26}
            />
          ) : undefined
        }
        title={draft?.name ?? ''}
        description={
          selected ? `${selected.entity_count} entities · version ${selected.version}` : undefined
        }
        showHistory={editor.showHistory}
        onShowHistoryChange={selected ? editor.setShowHistory : undefined}
        history={
          editor.showHistory ? (
            <SchemaVersionHistorySubSection
              versions={schemaVersions}
              isLoading={schemaVersionsLoading}
            />
          ) : null
        }
        editor={(selected || isNew) && draft ? <SchemaEditorForm key={selectedSchemaId} /> : null}
        emptyIcon={<TbCode size={22} />}
        emptyTitle="No type selected"
        emptySubtitle="Select an entity type from the sidebar to edit its schema."
        emptyAction={
          canEdit ? (
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => onSelectSchema(NEW_SCHEMA_ID)}
            >
              New entity type
            </Button>
          ) : null
        }
        dialogs={<SchemaEditorDialogs />}
      />
    </SchemaEditorProvider>
  );
};
