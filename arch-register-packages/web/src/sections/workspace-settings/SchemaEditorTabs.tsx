import { Tabs } from '@diagram-craft/app-components/Tabs';
import type {
  DetailLayoutConfig,
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { FieldType } from '../../lib/schemaPresentation';
import { SchemaFieldsEditor } from './SchemaFieldsEditor';
import { SchemaTemplatesEditor } from './SchemaTemplatesEditor';
import { SchemaValidationEditor } from './SchemaValidationEditor';
import { SchemaLayoutEditor } from './SchemaLayoutEditor';

export type SchemaPanelTab = 'fields' | 'templates' | 'validation' | 'layout';

export const SchemaEditorTabs = ({
  activeTab,
  onTabChange,
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  relationSchemas,
  enums,
  teams,
  canEdit,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup,
  templates,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  validationRules,
  validationPreviewPending,
  validationPreviewMessage,
  onPreviewValidation,
  onAddValidationRule,
  onUpdateValidationRule,
  onToggleValidationRule,
  onDeleteValidationRule,
  detailLayoutEnabled,
  onToggleDetailLayoutEnabled,
  detailLayout,
  onDetailLayoutChange
}: {
  activeTab: SchemaPanelTab;
  onTabChange: (tab: SchemaPanelTab) => void;
  fields: SchemaField[];
  groups: SchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  teams: { id: string; name: string }[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<SchemaField>) => void;
  onChangeFieldType: (fieldId: string, type: FieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onEditGroup: (group: SchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
  templates: EntityTemplate[];
  onAddTemplate: () => void;
  onEditTemplate: (template: EntityTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  validationRules: ValidationRule[];
  validationPreviewPending: boolean;
  validationPreviewMessage: string | null;
  onPreviewValidation: () => void;
  onAddValidationRule: () => void;
  onUpdateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  onToggleValidationRule: (index: number) => void;
  onDeleteValidationRule: (index: number) => void;
  detailLayoutEnabled: boolean;
  onToggleDetailLayoutEnabled: (enabled: boolean) => void;
  detailLayout: DetailLayoutConfig;
  onDetailLayoutChange: (layout: DetailLayoutConfig) => void;
}) => (
  <Tabs.Root value={activeTab} onValueChange={value => onTabChange(value as SchemaPanelTab)}>
    <Tabs.List aria-label="Schema editor sections">
      <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
      <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
      <Tabs.Trigger value="validation">Validation</Tabs.Trigger>
      <Tabs.Trigger value="layout">Layout</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="fields" style={{ height: 'auto' }}>
      <SchemaFieldsEditor
        fields={fields}
        groups={groups}
        sharedFieldGroupLinks={sharedFieldGroupLinks}
        fieldKeys={fieldKeys}
        schemas={schemas}
        relationSchemas={relationSchemas}
        enums={enums}
        teams={teams}
        canEdit={canEdit}
        onAddField={onAddField}
        onAddGroup={onAddGroup}
        onUpdateField={onUpdateField}
        onChangeFieldType={onChangeFieldType}
        onRemoveField={onRemoveField}
        onEditGroup={onEditGroup}
        onAccessGroup={onAccessGroup}
        onRemoveGroup={onRemoveGroup}
        onRemoveSharedGroup={onRemoveSharedGroup}
      />
    </Tabs.Content>
    <Tabs.Content value="templates" style={{ height: 'auto' }}>
      <SchemaTemplatesEditor
        templates={templates}
        canEdit={canEdit}
        onAdd={onAddTemplate}
        onEdit={onEditTemplate}
        onDelete={onDeleteTemplate}
      />
    </Tabs.Content>
    <Tabs.Content value="validation" style={{ height: 'auto' }}>
      <SchemaValidationEditor
        rules={validationRules}
        canEdit={canEdit}
        previewPending={validationPreviewPending}
        previewMessage={validationPreviewMessage}
        onPreview={onPreviewValidation}
        onAdd={onAddValidationRule}
        onUpdate={onUpdateValidationRule}
        onToggle={onToggleValidationRule}
        onDelete={onDeleteValidationRule}
      />
    </Tabs.Content>
    <Tabs.Content value="layout" style={{ height: 'auto' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          marginBottom: 12
        }}
      >
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={detailLayoutEnabled}
          onChange={e => onToggleDetailLayoutEnabled(e.target.checked)}
        />
        Use a custom layout for the Details/Edit screens
      </label>
      {detailLayoutEnabled ? (
        <SchemaLayoutEditor
          layout={detailLayout}
          fields={fields}
          groups={groups}
          relationSchemas={relationSchemas}
          canEdit={canEdit}
          onChange={onDetailLayoutChange}
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--cmp-fg-disabled)' }}>
          Using the default layout (fields, groups, metadata, links, relations, projects, and
          diagrams in their standard arrangement).
        </div>
      )}
    </Tabs.Content>
  </Tabs.Root>
);
