import { Button } from '@diagram-craft/app-components/Button';
import type {
  EntitySchema,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { buildDefaultLayout } from '../../lib/detailLayoutDefaults';
import type { EntityEditorExtra } from './entitySchemaAdapter';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import { SchemaLayoutEditor } from './SchemaLayoutEditor';
import layoutStyles from './SchemaLayoutEditor.module.css';

/** Detail-screen layout tab of the entity schema editor. */
export const SchemaLayoutTab = () => {
  const editor = useSchemaEditor<SchemaField, SchemaGroup, EntityEditorExtra, EntitySchema>();
  const canEdit = useCanEditSchemas();
  const { relationSchemas } = useWorkspaceContext();
  const { draft, selected } = editor;

  if (!draft) return null;

  const defaultLayoutFor = (fields: SchemaField[], groups: SchemaGroup[]) =>
    buildDefaultLayout({ ...selected, fields, groups } as EntitySchema, relationSchemas);

  const setEnabled = (enabled: boolean) =>
    editor.updateDraft(current => ({
      ...current,
      detailLayoutEnabled: enabled,
      detailLayout:
        enabled && !current.detailLayout
          ? defaultLayoutFor(current.fields, current.groups)
          : current.detailLayout
    }));

  if (!draft.detailLayoutEnabled) {
    return (
      <div className={layoutStyles.off}>
        <div className={layoutStyles.offCopy}>
          <div className={layoutStyles.offTitle}>Using the default layout</div>
          <div className={layoutStyles.offDesc}>
            Ungrouped fields, then each field group, then a fixed sidebar of metadata, links,
            relations, projects, and diagrams.
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setEnabled(true)}>
            Use a custom layout
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <label className={layoutStyles.toggle} style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          className={layoutStyles.checkbox}
          disabled={!canEdit}
          checked
          onChange={e => setEnabled(e.target.checked)}
        />
        Use a custom layout for the Details/Edit screens
      </label>
      <SchemaLayoutEditor
        layout={draft.detailLayout ?? defaultLayoutFor(draft.fields, draft.groups)}
        fields={draft.fields}
        groups={draft.groups}
        relationSchemas={relationSchemas}
        canEdit={canEdit}
        onChange={layout => editor.updateDraft(current => ({ ...current, detailLayout: layout }))}
      />
    </>
  );
};
