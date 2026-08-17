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
import type {
  WorkspaceCapabilityBinding,
  WorkspaceCapabilityBindings
} from '@arch-register/api-types/workspaceCapabilityContract';
import {
  useDeleteWorkspaceCapabilityConfiguration,
  useUpdateWorkspaceCapabilityConfiguration,
  useWorkspaceCapabilityConfigurations
} from '../../../hooks/useWorkspaceConfig';
import styles from './LifecycleSubSection.module.css';

type CapabilityType = 'api-specification' | 'business-glossary';

const capabilityTypes: CapabilityType[] = ['api-specification', 'business-glossary'];

export const WorkspaceCapabilitiesSubSection = ({
  workspaceSlug,
  schemas,
  onActionsChange
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const [activeTab, setActiveTab] = useState<CapabilityType>('api-specification');
  const [enabled, setEnabled] = useState(false);
  const { data: configurations = [], isLoading } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const configuration = configurations.find(item => item.type === activeTab);
  const definition = getWorkspaceCapabilityDefinition(activeTab);
  const [bindings, setBindings] = useState<WorkspaceCapabilityBindings>({});
  const mutation = useUpdateWorkspaceCapabilityConfiguration(workspaceSlug, activeTab);
  const deleteMutation = useDeleteWorkspaceCapabilityConfiguration(workspaceSlug, activeTab);

  const configuredBindings = useMemo(
    () => configuration?.bindings ?? {},
    [configuration?.bindings]
  );

  useEffect(() => {
    setEnabled(configuration != null);
    setBindings(configuredBindings);
  }, [configuredBindings, configuration]);

  const dirty =
    enabled !== (configuration != null) ||
    JSON.stringify(bindings) !== JSON.stringify(configuredBindings);

  const save = useCallback(async () => {
    if (!enabled || !definition) return;
    await mutation.mutateAsync({ bindings });
  }, [bindings, definition, enabled, mutation.mutateAsync]);

  const resetDraft = useCallback(() => {
    setEnabled(configuration != null);
    setBindings(configuredBindings);
  }, [configuredBindings, configuration]);

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
              {definition.bindingRoles.map(role => {
                const binding = bindings[role.id];
                const schemaId = binding?.target.kind === 'entity_schema' ? binding.target.id : '';
                const schema = schemas.find(item => item.id === schemaId);
                const draftBinding: WorkspaceCapabilityBinding = {
                  target: { kind: role.targetKind, id: schemaId },
                  ...(binding?.fieldMappings ? { fieldMappings: binding.fieldMappings } : {})
                };
                const resolution =
                  schema && role.fieldRoles.length > 0
                    ? resolveCapabilityFieldMappings(draftBinding, role.fieldRoles, schema.fields)
                    : null;
                return (
                  <div
                    key={role.id}
                    className={styles.field}
                    style={{ gridTemplateColumns: '1fr' }}
                  >
                    <FormElement label={role.label} required={role.required}>
                      {role.targetKind === 'entity_schema' ? (
                        <Select.Root
                          value={schemaId}
                          disabled={
                            !enabled || isLoading || mutation.isPending || deleteMutation.isPending
                          }
                          placeholder="Select an entity schema..."
                          onChange={value =>
                            updateBinding(role.id, {
                              target: { kind: role.targetKind, id: value ?? '' }
                            })
                          }
                        >
                          {schemas.map(candidate => (
                            <Select.Item key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </Select.Item>
                          ))}
                        </Select.Root>
                      ) : (
                        <div className={styles.sectionSub}>
                          Document and relation bindings are not used by this capability.
                        </div>
                      )}
                    </FormElement>

                    {schema && role.fieldRoles.length > 0 && (
                      <div>
                        <div className={styles.sectionTitle}>Field mappings</div>
                        <div className={styles.sectionSub}>
                          Map the required glossary roles to fields on this schema.
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
                                disabled={
                                  !enabled || mutation.isPending || deleteMutation.isPending
                                }
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
                                  <Select.Item value={fieldId}>
                                    Missing field · {fieldId}
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
