import { useState } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { SchemaFieldsEditor } from './SchemaFieldsEditor';
import { SchemaTemplatesTab } from './SchemaTemplatesEditor';
import { EntityValidationTab } from './ValidationTab';
import { SchemaLayoutTab } from './SchemaLayoutTab';
import { EntityDrawerEditor } from './EntityDrawerSettingsScreen';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';

type SchemaPanelTab = 'fields' | 'templates' | 'validation' | 'layout' | 'drawer';

/** Fields / Templates / Validation / Layout / Entity drawer tabs of the entity schema editor. */
export const SchemaEditorTabs = () => {
  const [activeTab, setActiveTab] = useState<SchemaPanelTab>('fields');
  const canEdit = useCanEditSchemas();
  const schemaId = useSchemaEditor().selected?.id;

  return (
    <Tabs.Root
      autoHeight
      value={activeTab}
      onValueChange={value => setActiveTab(value as SchemaPanelTab)}
    >
      <Tabs.List aria-label="Schema editor sections">
        <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
        <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
        <Tabs.Trigger value="validation">Validation</Tabs.Trigger>
        <Tabs.Trigger value="layout">Layout</Tabs.Trigger>
        <Tabs.Trigger value="drawer">Entity drawer</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="fields">
        <SchemaFieldsEditor />
      </Tabs.Content>
      <Tabs.Content value="templates">
        <SchemaTemplatesTab />
      </Tabs.Content>
      <Tabs.Content value="validation">
        <EntityValidationTab />
      </Tabs.Content>
      <Tabs.Content value="layout">
        <SchemaLayoutTab />
      </Tabs.Content>
      <Tabs.Content value="drawer">
        <EntityDrawerEditor schemaId={schemaId} canEdit={canEdit} />
      </Tabs.Content>
    </Tabs.Root>
  );
};
