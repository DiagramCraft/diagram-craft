import { useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbShare2 } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { useRelationSchemaVersions } from '../../hooks/useRelationSchemas';
import { useRelationSchemaAdapter } from './relationSchemaAdapter';
import { RelationEditorForm } from './RelationEditorForm';
import { RelationConstraintDialog } from './RelationConstraintDialog';
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import { SchemaEditorProvider } from './schemaEditorContext';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { SchemaEditorScreenShell } from './SchemaEditorScreenShell';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { useSchemaEditorController } from './schemaEditorState';

export const NEW_RELATION_SCHEMA_ID = 'new';
const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const RelationSchemaSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedRelationSchemaId = search.relationSchema;
  const isNew = selectedRelationSchemaId === NEW_RELATION_SCHEMA_ID;
  const {
    workspaceSlug,
    relationSchemas,
    enums,
    fieldGroups = [],
    permissions
  } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const selectedIndex = relationSchemas.findIndex(schema => schema.id === selectedRelationSchemaId);
  const selected = selectedIndex >= 0 ? (relationSchemas[selectedIndex] ?? null) : null;

  const onSelectRelationSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'relation-types', relationSchema: id || undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const { adapter, isSaving } = useRelationSchemaAdapter(workspaceSlug);
  const editor = useSchemaEditorController({
    selected,
    isNew,
    items: relationSchemas,
    fieldGroups,
    firstEnumId: enums[0]?.id,
    adapter,
    onSelect: onSelectRelationSchema
  });
  const draft = editor.draft;

  const { data: versions, isLoading: versionsLoading } = useRelationSchemaVersions(
    workspaceSlug,
    editor.showHistory && selected ? (selectedRelationSchemaId ?? null) : null
  );

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
        eyebrow="Relation"
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
        titleTestId="relation-schema-editor-title"
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
          selected
            ? `${selected.relation_count} relations · version ${selected.version}`
            : undefined
        }
        showHistory={editor.showHistory}
        onShowHistoryChange={selected ? editor.setShowHistory : undefined}
        history={
          editor.showHistory ? (
            <SchemaVersionHistorySubSection versions={versions} isLoading={versionsLoading} />
          ) : null
        }
        editor={
          (selected || isNew) && draft ? (
            <RelationEditorForm key={selectedRelationSchemaId} />
          ) : null
        }
        emptyIcon={<TbShare2 size={22} />}
        emptyTitle="No relation type selected"
        emptySubtitle="Select a relation type from the sidebar to edit it."
        emptyAction={
          canEdit ? (
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => onSelectRelationSchema(NEW_RELATION_SCHEMA_ID)}
            >
              New relation type
            </Button>
          ) : null
        }
        dialogs={
          <SchemaEditorDialogs
            extraDialogs={
              <RelationConstraintDialog
                data={editor.constraintViolations}
                onClose={() => editor.setConstraintViolations(null)}
              />
            }
          />
        }
      />
    </SchemaEditorProvider>
  );
};
