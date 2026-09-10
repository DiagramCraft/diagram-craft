import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId,
  resolveCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type {
  WorkspaceCapabilityBinding,
  WorkspaceCapabilityBindings,
  WorkspaceCapabilityTargetKind
} from '@arch-register/api-types/workspaceCapabilityContract';
import type { StrategyModelViewConfig } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import {
  useDeleteWorkspaceCapabilityConfiguration,
  useUpdateWorkspaceCapabilityConfiguration,
  useWorkspaceCapabilityConfigurations
} from '../../../hooks/useWorkspaceConfig';
import {
  StrategyDashboardEditor,
  StrategyFieldsEditor
} from './strategy-view/StrategyModelViewConfigEditor';
import { toEditableConfig, viewConfigDirty } from './strategy-view/strategyViewConfigState';
import styles from './LifecycleSubSection.module.css';

type CapabilityType = 'api-specification' | 'business-glossary' | 'retention' | 'strategy-model';

const capabilityTypes: CapabilityType[] = [
  'api-specification',
  'business-glossary',
  'retention',
  'strategy-model'
];

/** A target-kind-agnostic view of the schemas a binding role can pick from and resolve fields on. */
type BindingTarget = { id: string; name: string; fields: EntitySchema['fields'] };

const targetsFor = (
  kind: WorkspaceCapabilityTargetKind,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): BindingTarget[] => {
  if (kind === 'entity_schema') return schemas;
  if (kind === 'relation_schema')
    return relationSchemas.map(schema => ({ ...schema, fields: schema.fields as never }));
  return [];
};

export const WorkspaceCapabilitiesSubSection = ({
  workspaceSlug,
  schemas,
  relationSchemas,
  onActionsChange
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const [activeTab, setActiveTab] = useState<CapabilityType>('api-specification');
  const [strategyTab, setStrategyTab] = useState('bindings');
  const [enabled, setEnabled] = useState(false);
  const { data: configurations = [], isLoading } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const configuration = configurations.find(item => item.type === activeTab);
  const definition = getWorkspaceCapabilityDefinition(activeTab);
  const [bindings, setBindings] = useState<WorkspaceCapabilityBindings>({});
  const [viewConfig, setViewConfig] = useState<StrategyModelViewConfig | null>(null);
  const mutation = useUpdateWorkspaceCapabilityConfiguration(workspaceSlug, activeTab);
  const deleteMutation = useDeleteWorkspaceCapabilityConfiguration(workspaceSlug, activeTab);

  const configuredBindings = useMemo(
    () => configuration?.bindings ?? {},
    [configuration?.bindings]
  );

  const isStrategyModel = activeTab === 'strategy-model';

  useEffect(() => {
    setEnabled(configuration != null);
    setBindings(configuredBindings);
    setViewConfig(isStrategyModel ? toEditableConfig(configuration?.view_config) : null);
  }, [configuredBindings, configuration, isStrategyModel]);

  const dirty =
    enabled !== (configuration != null) ||
    JSON.stringify(bindings) !== JSON.stringify(configuredBindings) ||
    (isStrategyModel &&
      viewConfig != null &&
      viewConfigDirty(viewConfig, configuration?.view_config));

  const save = useCallback(async () => {
    if (!enabled || !definition) return;
    await mutation.mutateAsync({
      bindings,
      ...(isStrategyModel && viewConfig ? { viewConfig } : {})
    });
  }, [bindings, definition, enabled, isStrategyModel, mutation.mutateAsync, viewConfig]);

  const resetDraft = useCallback(() => {
    setEnabled(configuration != null);
    setBindings(configuredBindings);
    setViewConfig(isStrategyModel ? toEditableConfig(configuration?.view_config) : null);
  }, [configuredBindings, configuration, isStrategyModel]);

  useEffect(() => {
    onActionsChange(
      <>
        <Button
          disabled={!dirty || mutation.isPending || deleteMutation.isPending}
          onClick={resetDraft}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!enabled || !dirty || mutation.isPending || deleteMutation.isPending}
          onClick={() => void save()}
        >
          {mutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </>
    );
  }, [
    deleteMutation.isPending,
    dirty,
    enabled,
    mutation.isPending,
    onActionsChange,
    resetDraft,
    save
  ]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (!definition) return null;

  const handleEnabledChange = (nextEnabled: boolean | undefined) => {
    if (nextEnabled) {
      setEnabled(true);
      if (Object.keys(bindings).length === 0) {
        setBindings(
          Object.fromEntries(
            definition.bindingRoles.map(role => [
              role.id,
              { target: { kind: role.targetKind, id: '' } }
            ])
          ) as WorkspaceCapabilityBindings
        );
      }
      return;
    }
    if (!configuration) {
      setEnabled(false);
      return;
    }
    if (!window.confirm(`Disable the ${definition.label} capability for this workspace?`)) return;
    setEnabled(false);
    void deleteMutation.mutateAsync().catch(() => setEnabled(true));
  };

  const updateBinding = (bindingId: string, binding: WorkspaceCapabilityBinding) => {
    setBindings(current => ({ ...current, [bindingId]: binding }));
  };

  const controlsBusy = mutation.isPending || deleteMutation.isPending;
  const businessCapabilitySchema = schemas.find(
    schema => schema.id === bindings['business_capability']?.target.id
  );
  const staleViewDiagnostics = (configuration?.diagnostics ?? [])
    .filter(diagnostic => diagnostic.code === 'stale_view_field')
    .map(diagnostic => diagnostic.message);

  const bindingRolesContent = (
    <>
      {definition.bindingRoles.map(role => {
        const binding = bindings[role.id];
        const targets = targetsFor(role.targetKind, schemas, relationSchemas);
        const schemaId = binding?.target.kind === role.targetKind ? binding.target.id : '';
        const schema = targets.find(item => item.id === schemaId);
        const draftBinding: WorkspaceCapabilityBinding = {
          target: { kind: role.targetKind, id: schemaId },
          ...(binding?.fieldMappings ? { fieldMappings: binding.fieldMappings } : {})
        };
        const resolution =
          schema && role.fieldRoles.length > 0
            ? resolveCapabilityFieldMappings(draftBinding, role.fieldRoles, schema.fields)
            : null;
        return (
          <div key={role.id} className={styles.field} style={{ gridTemplateColumns: '1fr' }}>
            <FormElement label={role.label} required={role.required}>
              {role.targetKind === 'document_type' ? (
                <div className={styles.sectionSub}>
                  Document bindings are not used by this capability.
                </div>
              ) : (
                <Select.Root
                  value={schemaId}
                  disabled={!enabled || isLoading || controlsBusy}
                  placeholder={
                    role.targetKind === 'entity_schema'
                      ? 'Select an entity schema...'
                      : 'Select a relation schema...'
                  }
                  onChange={value =>
                    updateBinding(role.id, {
                      target: { kind: role.targetKind, id: value ?? '' }
                    })
                  }
                >
                  {targets.map(candidate => (
                    <Select.Item key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              )}
            </FormElement>

            {schema && role.fieldRoles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <div className={styles.sectionTitle}>Field mappings</div>
                  <div className={styles.sectionSub}>
                    Map the required roles to fields on this schema.
                  </div>
                </div>
                {role.fieldRoles.map(fieldRole => {
                  const fieldId = resolveCapabilityFieldId(draftBinding, fieldRole);
                  const validFields = schema.fields.filter(
                    field =>
                      !field.archived &&
                      field.type !== 'derived' &&
                      fieldRole.allowedTypes.includes(field.type as never)
                  );
                  return (
                    <FormElement
                      key={fieldRole.id}
                      label={fieldRole.label}
                      required={fieldRole.required}
                    >
                      <Select.Root
                        value={fieldId}
                        disabled={!enabled || controlsBusy}
                        onChange={value => {
                          if (!value) return;
                          updateBinding(role.id, {
                            target: { kind: role.targetKind, id: schemaId },
                            fieldMappings: {
                              ...(binding?.fieldMappings ?? {}),
                              [fieldRole.id]: value
                            }
                          });
                        }}
                      >
                        {!validFields.some(field => field.id === fieldId) && (
                          <Select.Item value={fieldId}>Missing field · {fieldId}</Select.Item>
                        )}
                        {validFields.map(field => (
                          <Select.Item key={field.id} value={field.id}>
                            {field.name} · {field.id}
                          </Select.Item>
                        ))}
                      </Select.Root>
                    </FormElement>
                  );
                })}
              </div>
            )}
            {resolution && resolution.issues.length > 0 && (
              <div className={styles.capabilityUnknownFields}>
                {resolution.issues.map(issue => issue.message).join(' ')}
              </div>
            )}
          </div>
        );
      })}
      {configuration && !configuration.valid && (
        <div className={styles.capabilityUnknownFields}>
          {configuration.diagnostics
            .filter(diagnostic => diagnostic.code !== 'stale_view_field')
            .map(diagnostic => diagnostic.message)
            .join(' ')}
        </div>
      )}
    </>
  );

  return (
    <div className={styles.blockList}>
      <Tabs.Root value={activeTab} onValueChange={value => setActiveTab(value as CapabilityType)}>
        <Tabs.List aria-label="Capability binding types">
          {capabilityTypes.map(type => {
            const item = getWorkspaceCapabilityDefinition(type);
            return item ? (
              <Tabs.Trigger key={type} value={type}>
                {item.label}
              </Tabs.Trigger>
            ) : null;
          })}
        </Tabs.List>
        <Tabs.Content value={activeTab} style={{ height: 'auto' }}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.capabilityHeader}>
                <div>
                  <div className={styles.sectionTitle}>{definition.label}</div>
                  <div className={styles.sectionSub}>{definition.description}</div>
                </div>
                <label className={styles.capabilityToggle}>
                  <Checkbox
                    value={enabled}
                    disabled={isLoading || mutation.isPending || deleteMutation.isPending}
                    onChange={handleEnabledChange}
                  />
                  Enabled
                </label>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {isStrategyModel && enabled && viewConfig ? (
                <Tabs.Root value={strategyTab} onValueChange={setStrategyTab}>
                  <Tabs.List aria-label="Strategy model configuration">
                    <Tabs.Trigger value="bindings">Bindings</Tabs.Trigger>
                    <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
                    <Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
                  </Tabs.List>
                  <Tabs.Content value="bindings" style={{ height: 'auto' }}>
                    {bindingRolesContent}
                  </Tabs.Content>
                  <Tabs.Content value="fields" style={{ height: 'auto' }}>
                    <StrategyFieldsEditor
                      schema={businessCapabilitySchema}
                      value={viewConfig}
                      disabled={controlsBusy}
                      diagnostics={staleViewDiagnostics}
                      onChange={setViewConfig}
                    />
                  </Tabs.Content>
                  <Tabs.Content value="dashboard" style={{ height: 'auto' }}>
                    <StrategyDashboardEditor
                      schema={businessCapabilitySchema}
                      value={viewConfig}
                      disabled={controlsBusy}
                      onChange={setViewConfig}
                    />
                  </Tabs.Content>
                </Tabs.Root>
              ) : (
                bindingRolesContent
              )}
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};
