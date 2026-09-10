import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TbAlertTriangle, TbBox } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
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
import t from './CapabilityBindingEditor.module.css';

export type CapabilityBindingSubTab = 'bindings' | 'fields' | 'dashboard';

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

/**
 * Per-capability binding editor: the "Enabled" toggle, schema/field role mappings, and — for
 * `strategy-model` — the Fields / Dashboard view-config editors. Which panel renders is driven by
 * the parent via `subTab`; the component stays mounted across sub-tab switches so unsaved edits
 * survive. Save / Cancel are hoisted to the screen header via `onActionsChange`.
 */
export const CapabilityBindingEditor = ({
  workspaceSlug,
  capabilityType,
  schemas,
  relationSchemas,
  subTab,
  onActionsChange,
  onEnabledControlChange
}: {
  workspaceSlug: string;
  capabilityType: string;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  subTab: CapabilityBindingSubTab;
  onActionsChange: (actions: ReactNode | undefined) => void;
  /** Hoists the "Enabled" toggle above the tab strip on the screen. */
  onEnabledControlChange: (control: ReactNode | undefined) => void;
}) => {
  const [enabled, setEnabled] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const { data: configurations = [], isLoading } =
    useWorkspaceCapabilityConfigurations(workspaceSlug);
  const configuration = configurations.find(item => item.type === capabilityType);
  const definition = getWorkspaceCapabilityDefinition(capabilityType);
  const [bindings, setBindings] = useState<WorkspaceCapabilityBindings>({});
  const [viewConfig, setViewConfig] = useState<StrategyModelViewConfig | null>(null);
  const mutation = useUpdateWorkspaceCapabilityConfiguration(workspaceSlug, capabilityType);
  const deleteMutation = useDeleteWorkspaceCapabilityConfiguration(workspaceSlug, capabilityType);

  const configuredBindings = useMemo(
    () => configuration?.bindings ?? {},
    [configuration?.bindings]
  );

  const isStrategyModel = capabilityType === 'strategy-model';

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

  const handleEnabledChange = useCallback(
    (nextEnabled: boolean | undefined) => {
      if (!definition) return;
      if (nextEnabled) {
        setEnabled(true);
        setBindings(current =>
          Object.keys(current).length > 0
            ? current
            : (Object.fromEntries(
                definition.bindingRoles.map(role => [
                  role.id,
                  { target: { kind: role.targetKind, id: '' } }
                ])
              ) as WorkspaceCapabilityBindings)
        );
        return;
      }
      if (!configuration) {
        setEnabled(false);
        return;
      }
      setConfirmDisableOpen(true);
    },
    [configuration, definition]
  );

  const confirmDisable = useCallback(() => {
    setConfirmDisableOpen(false);
    setEnabled(false);
    void deleteMutation.mutateAsync().catch(() => setEnabled(true));
  }, [deleteMutation.mutateAsync]);

  const toggleBusy = isLoading || mutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    onEnabledControlChange(
      <button
        type="button"
        className={`${t.toggle} ${enabled ? t.on : ''}`}
        disabled={toggleBusy}
        aria-pressed={enabled}
        onClick={() => handleEnabledChange(!enabled)}
      >
        <span className={t.switch} />
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
    );
  }, [enabled, toggleBusy, handleEnabledChange, onEnabledControlChange]);

  useEffect(() => () => onEnabledControlChange(undefined), [onEnabledControlChange]);

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

  const bindingCount = definition.bindingRoles.length;

  const bindingRolesContent = (
    <>
      <p className={t.mapIntro}>
        {definition.label} expects {bindingCount} schema binding{bindingCount === 1 ? '' : 's'}.
        Bind each to a schema in this workspace, then map its fields.
      </p>
      <div className={t.map}>
        <div className={t.mapHead}>
          <span>Expected</span>
          <span>Mapped to</span>
        </div>
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
          const isDocument = role.targetKind === 'document_type';
          const unbound = !isDocument && !schema;
          const hasRows = role.fieldRoles.length > 0;

          return (
            <div className={t.grp} key={role.id}>
              <div className={`${t.grpHead} ${unbound ? t.unbound : ''}`}>
                <div className={t.grpL}>
                  <TbBox size={13} className={t.grpIcon} />
                  <span className={t.grpName}>{role.label}</span>
                  <span className={t.grpReq}>{role.required ? 'required' : 'optional'}</span>
                </div>
                <div className={t.grpCell}>
                  {isDocument ? (
                    <span className={t.note}>
                      Document bindings are not used by this capability.
                    </span>
                  ) : (
                    <Select.Root
                      value={schemaId}
                      disabled={!enabled || isLoading || controlsBusy}
                      style={{ width: '100%' }}
                      placeholder={
                        role.targetKind === 'entity_schema'
                          ? 'Choose an entity schema…'
                          : 'Choose a relation schema…'
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
                </div>
              </div>

              {schema && hasRows && (
                <div className={t.grpRows}>
                  {role.fieldRoles.map(fieldRole => {
                    const fieldId = resolveCapabilityFieldId(draftBinding, fieldRole);
                    const validFields = schema.fields.filter(
                      field =>
                        !field.archived &&
                        field.type !== 'derived' &&
                        fieldRole.allowedTypes.includes(field.type as never)
                    );
                    const missing = fieldRole.required && !fieldId;
                    return (
                      <div
                        className={`${t.row} ${missing ? t.missing : ''}`}
                        key={fieldRole.id}
                      >
                        <div className={t.rowRole}>
                          <span className={t.rowTick} />
                          <span className={t.rowName}>{fieldRole.label}</span>
                          {fieldRole.required ? (
                            <span className={t.reqStar}>*</span>
                          ) : (
                            <span className={t.optional}>optional</span>
                          )}
                        </div>
                        <div className={t.rowCell}>
                          <Select.Root
                            value={fieldId}
                            disabled={!enabled || controlsBusy}
                            style={{ width: '100%' }}
                            placeholder="Choose field…"
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
                            {!validFields.some(field => field.id === fieldId) && fieldId && (
                              <Select.Item value={fieldId}>Missing field · {fieldId}</Select.Item>
                            )}
                            {validFields.map(field => (
                              <Select.Item key={field.id} value={field.id}>
                                {field.name} · {field.id}
                              </Select.Item>
                            ))}
                          </Select.Root>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {unbound && hasRows && (
                <div className={t.grpRows}>
                  <div className={t.row} style={{ gridTemplateColumns: '1fr' }}>
                    <span className={t.optional}>
                      Bind a schema to map its {role.fieldRoles.length} expected fields.
                    </span>
                  </div>
                </div>
              )}

              {resolution && resolution.issues.length > 0 && (
                <div className={t.issues}>
                  {resolution.issues.map(issue => issue.message).join(' ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {configuration && !configuration.valid && (
        <div className={t.tableIssues}>
          <TbAlertTriangle size={13} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {configuration.diagnostics
              .filter(diagnostic => diagnostic.code !== 'stale_view_field')
              .map(diagnostic => diagnostic.message)
              .join(' ')}
          </span>
        </div>
      )}
    </>
  );

  const strategyViewUnavailable = (
    <div className={t.note}>
      Enable the capability and bind the Business Capability entity schema to configure this view.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
      {subTab === 'bindings' && bindingRolesContent}
      {subTab === 'fields' &&
        (isStrategyModel && enabled && viewConfig ? (
          <StrategyFieldsEditor
            schema={businessCapabilitySchema}
            value={viewConfig}
            disabled={controlsBusy}
            diagnostics={staleViewDiagnostics}
            onChange={setViewConfig}
          />
        ) : (
          strategyViewUnavailable
        ))}
      {subTab === 'dashboard' &&
        (isStrategyModel && enabled && viewConfig ? (
          <StrategyDashboardEditor
            schema={businessCapabilitySchema}
            value={viewConfig}
            disabled={controlsBusy}
            onChange={setViewConfig}
          />
        ) : (
          strategyViewUnavailable
        ))}

      {confirmDisableOpen && (
        <DeleteConfirmationDialog
          open
          title="Disable capability"
          message={`Disable the ${definition.label} capability for this workspace?`}
          detail="The stored bindings and configuration are removed. You can re-enable it later, but you'll need to configure it again."
          confirmLabel="Disable"
          onConfirm={confirmDisable}
          onCancel={() => setConfirmDisableOpen(false)}
        />
      )}
    </div>
  );
};
