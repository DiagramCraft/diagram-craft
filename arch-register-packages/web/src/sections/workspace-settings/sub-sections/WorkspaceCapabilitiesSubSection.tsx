import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId,
  resolveCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type { WorkspaceCapabilityBinding } from '@arch-register/api-types/workspaceCapabilityContract';
import {
  useDeleteWorkspaceCapabilityConfiguration,
  useUpdateWorkspaceCapabilityConfiguration,
  useWorkspaceCapabilityConfigurations
} from '../../../hooks/useWorkspaceConfig';
import styles from './LifecycleSubSection.module.css';

const capabilityType = 'api-specification';
type CapabilityBindingTab = 'api-specification';

export const WorkspaceCapabilitiesSubSection = ({
  workspaceSlug,
  schemas,
  onActionsChange
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const [activeTab, setActiveTab] = useState<CapabilityBindingTab>('api-specification');
  const [enabled, setEnabled] = useState(false);
  const { data: configurations = [], isLoading } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const configuration = configurations.find(item => item.type === capabilityType);
  const binding = configuration?.bindings.api;
  const isConfigured = configuration != null;
  const definition = getWorkspaceCapabilityDefinition(capabilityType);
  const configuredSchemaId = binding?.target.kind === 'entity_schema' ? binding.target.id : '';
  const configuredFieldMappings = useMemo(
    () => binding?.fieldMappings ?? {},
    [binding?.fieldMappings]
  );
  const [schemaId, setSchemaId] = useState(configuredSchemaId);
  const [fieldMappings, setFieldMappings] =
    useState<Record<string, string>>(configuredFieldMappings);
  const mutation = useUpdateWorkspaceCapabilityConfiguration(workspaceSlug, capabilityType);
  const deleteMutation = useDeleteWorkspaceCapabilityConfiguration(workspaceSlug, capabilityType);

  useEffect(() => {
    setEnabled(isConfigured);
    setSchemaId(configuredSchemaId);
    setFieldMappings(configuredFieldMappings);
  }, [configuredFieldMappings, configuredSchemaId, isConfigured]);

  const schema = useMemo(() => schemas.find(item => item.id === schemaId), [schemas, schemaId]);
  const draftBinding: WorkspaceCapabilityBinding = {
    target: { kind: 'entity_schema', id: schemaId },
    ...(Object.keys(fieldMappings).length > 0 ? { fieldMappings } : {})
  };
  const resolution =
    definition && schema
      ? resolveCapabilityFieldMappings(
          draftBinding,
          definition.bindingRoles[0]?.fieldRoles ?? [],
          schema.fields
        )
      : null;
  const dirty =
    enabled !== isConfigured ||
    schemaId !== configuredSchemaId ||
    JSON.stringify(fieldMappings) !== JSON.stringify(configuredFieldMappings);

  const save = useCallback(async () => {
    if (!enabled || !schemaId) return;
    await mutation.mutateAsync({
      bindings: {
        api: {
          target: { kind: 'entity_schema', id: schemaId },
          ...(Object.keys(fieldMappings).length > 0 ? { fieldMappings } : {})
        }
      }
    });
  }, [enabled, fieldMappings, mutation.mutateAsync, schemaId]);

  const resetDraft = useCallback(() => {
    setEnabled(isConfigured);
    setSchemaId(configuredSchemaId);
    setFieldMappings(configuredFieldMappings);
  }, [configuredFieldMappings, configuredSchemaId, isConfigured]);

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
          disabled={
            !enabled || !schemaId || !dirty || mutation.isPending || deleteMutation.isPending
          }
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
    save,
    schemaId
  ]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (!definition) return null;

  const handleEnabledChange = (nextEnabled: boolean | undefined) => {
    if (nextEnabled) {
      setEnabled(true);
      return;
    }
    if (!configuration) {
      setEnabled(false);
      return;
    }
    if (!window.confirm('Disable the API specification capability for this workspace?')) return;

    setEnabled(false);
    void deleteMutation.mutateAsync().catch(() => setEnabled(true));
  };

  return (
    <div className={styles.blockList}>
      <Tabs.Root
        value={activeTab}
        onValueChange={value => setActiveTab(value as CapabilityBindingTab)}
      >
        <Tabs.List aria-label="Capability binding types">
          <Tabs.Trigger value="api-specification">API Specification</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="api-specification" style={{ height: 'auto' }}>
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
              <FormElement label="API entity schema" required>
                <Select.Root
                  value={schemaId}
                  disabled={!enabled || isLoading || mutation.isPending || deleteMutation.isPending}
                  placeholder="Select an entity schema..."
                  onChange={value => {
                    setSchemaId(value ?? '');
                    setFieldMappings({});
                  }}
                >
                  {schemas.map(candidate => (
                    <Select.Item key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>

              {schema && (
                <div className={styles.field} style={{ gridTemplateColumns: '1fr' }}>
                  <div>
                    <div className={styles.sectionTitle}>Field mappings</div>
                    <div className={styles.sectionSub}>
                      Map integration roles to fields on the selected schema. Defaults use the
                      conventional field IDs.
                    </div>
                  </div>
                  <div>
                    {definition.bindingRoles[0]?.fieldRoles.map(role => {
                      const capabilityFieldId = resolveCapabilityFieldId(draftBinding, role);
                      const validFields = schema.fields.filter(
                        field =>
                          !field.archived &&
                          field.type !== 'derived' &&
                          role.allowedTypes.some(type => type === field.type)
                      );
                      return (
                        <FormElement key={role.id} label={role.label}>
                          <Select.Root
                            value={capabilityFieldId}
                            disabled={!enabled || mutation.isPending || deleteMutation.isPending}
                            onChange={value => {
                              if (!value) return;
                              setFieldMappings(current => ({ ...current, [role.id]: value }));
                            }}
                          >
                            {!validFields.some(field => field.id === capabilityFieldId) && (
                              <Select.Item value={capabilityFieldId}>
                                Missing field · {capabilityFieldId}
                              </Select.Item>
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
                  {resolution && resolution.issues.length > 0 && (
                    <div className={styles.capabilityUnknownFields}>
                      {resolution.issues.map(issue => issue.message).join(' ')}
                    </div>
                  )}
                </div>
              )}

              {configuration && !configuration.valid && (
                <div className={styles.capabilityUnknownFields}>
                  {configuration.diagnostics.map(diagnostic => diagnostic.message).join(' ')}
                </div>
              )}
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};
