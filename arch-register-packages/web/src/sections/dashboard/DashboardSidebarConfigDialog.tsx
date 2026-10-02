import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  DashboardFacetConfig,
  DashboardSidebarConfig,
  DashboardSidebarOption
} from '@arch-register/api-types/dashboardContract';
import { facetKindForField } from './dashboardFacetFields';
import { useSchemas } from '../../hooks/useSchemas';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import {
  isFacetsConfigValid,
  isOptionsConfigValid,
  isValidVariableName,
  moveItem,
  normalizeFacets,
  normalizeOptions
} from './dashboardSidebarConfig';
import styles from './WidgetConfigDialog.module.css';

type Props = {
  open: boolean;
  workspaceSlug: string;
  sidebar: DashboardSidebarConfig | null;
  onClose: () => void;
  onSave: (sidebar: DashboardSidebarConfig | null) => void;
};

/**
 * Configures a dashboard's optional sidebar (#3467): a single-select `entity-picker`, a
 * multi-select `facets` sidebar, or a single-select `options` list of fixed value/label pairs. Variables are referenced by widget config as `$<variableName>`,
 * see `resolveSidebarVariableReferences.ts`.
 */
export const DashboardSidebarConfigDialog = ({
  open,
  workspaceSlug,
  sidebar,
  onClose,
  onSave
}: Props) => {
  const entityPicker = sidebar?.kind === 'entity-picker' ? sidebar : null;
  const facetsSidebar = sidebar?.kind === 'facets' ? sidebar : null;
  const optionsSidebar = sidebar?.kind === 'options' ? sidebar : null;
  const schemas = useSchemas(workspaceSlug);
  const [kind, setKind] = useState<DashboardSidebarConfig['kind']>(
    sidebar?.kind ?? 'entity-picker'
  );
  const [optionsVariableName, setOptionsVariableName] = useState(
    optionsSidebar?.variableName ?? ''
  );
  const [optionsItemLabel, setOptionsItemLabel] = useState(optionsSidebar?.itemLabel ?? '');
  const [optionsAllLabel, setOptionsAllLabel] = useState(optionsSidebar?.allLabel ?? '');
  const [options, setOptions] = useState<DashboardSidebarOption[]>(optionsSidebar?.options ?? []);
  const [schemaName, setSchemaName] = useState(entityPicker?.schemaName ?? '');
  const [variableName, setVariableName] = useState(entityPicker?.variableName ?? '');
  const [itemLabel, setItemLabel] = useState(entityPicker?.itemLabel ?? '');
  const [facetsSchemaName, setFacetsSchemaName] = useState(facetsSidebar?.schemaName ?? '');
  const [facets, setFacets] = useState<DashboardFacetConfig[]>(facetsSidebar?.facets ?? []);

  const referenceFieldNames = (schemas.data ?? [])
    .find(schema => schema.name === facetsSchemaName)
    ?.fields.filter(field => facetKindForField(field) !== undefined)
    .map(field => field.name);

  const updateFacet = (index: number, patch: Partial<DashboardFacetConfig>) =>
    setFacets(current => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const changeFacetsSchema = (name: string) => {
    setFacetsSchemaName(name);
    const names = (schemas.data ?? [])
      .find(schema => schema.name === name)
      ?.fields.filter(field => facetKindForField(field) !== undefined)
      .map(field => field.name);
    setFacets(current =>
      current.map(f =>
        f.fieldId.startsWith('_') || names?.includes(f.fieldId) ? f : { ...f, fieldId: '' }
      )
    );
  };

  const updateOption = (index: number, patch: Partial<DashboardSidebarOption>) =>
    setOptions(current => current.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const canSave =
    kind === 'facets'
      ? isFacetsConfigValid(facetsSchemaName, facets)
      : kind === 'options'
        ? isOptionsConfigValid(optionsVariableName, options)
        : schemaName.trim() !== '' && isValidVariableName(variableName.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dashboard sidebar"
      width={460}
      footerLeft={
        sidebar && (
          <Button
            variant="danger"
            onClick={() => {
              onSave(null);
              onClose();
            }}
          >
            Remove sidebar
          </Button>
        )
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save',
          type: 'default',
          disabled: !canSave,
          onClick: () => {
            onSave(
              kind === 'facets'
                ? {
                    kind: 'facets',
                    schemaName: facetsSchemaName.trim(),
                    facets: normalizeFacets(facets)
                  }
                : kind === 'options'
                  ? {
                      kind: 'options',
                      variableName: optionsVariableName.trim(),
                      itemLabel: optionsItemLabel.trim() || undefined,
                      allLabel: optionsAllLabel.trim() || undefined,
                      options: normalizeOptions(options)
                    }
                  : {
                      kind: 'entity-picker',
                      schemaName: schemaName.trim(),
                      variableName: variableName.trim(),
                      itemLabel: itemLabel.trim() || undefined,
                      ...(entityPicker?.valueKind ? { valueKind: entityPicker.valueKind } : {})
                    }
            );
            onClose();
          }
        }
      ]}
    >
      <DialogContent>
        <DialogSection label="Sidebar type">
          <select
            className={styles.selectInput}
            value={kind}
            onChange={event => setKind(event.currentTarget.value as DashboardSidebarConfig['kind'])}
          >
            <option value="entity-picker">Entity picker (single select)</option>
            <option value="facets">Facets (multi select)</option>
            <option value="options">Fixed options (single select)</option>
          </select>
        </DialogSection>
        {kind === 'options' ? (
          <>
            <DialogSection label="Variable name">
              <input
                type="text"
                className={styles.labelInput}
                placeholder="e.g. status"
                value={optionsVariableName}
                onChange={event => setOptionsVariableName(event.currentTarget.value)}
              />
              <div className={styles.hint}>
                Referenced in widget config as <code>${optionsVariableName || '<name>'}</code>;
                empty when nothing is selected.
              </div>
            </DialogSection>
            <DialogSection label="List label" required={false}>
              <input
                type="text"
                className={styles.labelInput}
                value={optionsItemLabel}
                onChange={event => setOptionsItemLabel(event.currentTarget.value)}
              />
            </DialogSection>
            <DialogSection label="“All” row label" required={false}>
              <input
                type="text"
                className={styles.labelInput}
                placeholder="e.g. All (leave empty for no “All” row)"
                value={optionsAllLabel}
                onChange={event => setOptionsAllLabel(event.currentTarget.value)}
              />
            </DialogSection>
            <DialogSection label="Options">
              <div className={styles.options}>
                {options.map((option, index) => (
                  <div key={index} className={styles.options}>
                    <input
                      type="text"
                      className={styles.labelInput}
                      placeholder="Value"
                      value={option.value}
                      onChange={event => updateOption(index, { value: event.currentTarget.value })}
                    />
                    <input
                      type="text"
                      className={styles.labelInput}
                      placeholder="Label"
                      value={option.label}
                      onChange={event => updateOption(index, { label: event.currentTarget.value })}
                    />
                    <div className={styles.optionRow}>
                      <Button
                        variant="secondary"
                        disabled={index === 0}
                        onClick={() => setOptions(current => moveItem(current, index, -1))}
                      >
                        Move up
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={index === options.length - 1}
                        onClick={() => setOptions(current => moveItem(current, index, 1))}
                      >
                        Move down
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setOptions(current => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => setOptions(current => [...current, { value: '', label: '' }])}
                >
                  Add option
                </Button>
              </div>
            </DialogSection>
          </>
        ) : kind === 'facets' ? (
          <>
            <DialogSection label="Entity schema">
              <select
                className={styles.selectInput}
                value={facetsSchemaName}
                onChange={event => changeFacetsSchema(event.currentTarget.value)}
              >
                <option value="">Select a schema…</option>
                {(schemas.data ?? []).map(schema => (
                  <option key={schema.id} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </DialogSection>
            <DialogSection label="Facets">
              <div className={styles.options}>
                {facets.map((facet, index) => (
                  <div key={index} className={styles.options}>
                    <select
                      className={styles.selectInput}
                      value={facet.fieldId}
                      onChange={event => updateFacet(index, { fieldId: event.currentTarget.value })}
                    >
                      <option value="">Select a field…</option>
                      <option value="_owner">Owner</option>
                      <option value="_lifecycle">Lifecycle</option>
                      {(referenceFieldNames ?? []).map(name => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.labelInput}
                      placeholder="Variable name, e.g. category"
                      value={facet.variableName}
                      onChange={event =>
                        updateFacet(index, { variableName: event.currentTarget.value })
                      }
                    />
                    <input
                      type="text"
                      className={styles.labelInput}
                      placeholder="Label (optional)"
                      value={facet.itemLabel ?? ''}
                      onChange={event =>
                        updateFacet(index, { itemLabel: event.currentTarget.value })
                      }
                    />
                    <div className={styles.optionRow}>
                      <Button
                        variant="secondary"
                        disabled={index === 0}
                        onClick={() => setFacets(current => moveItem(current, index, -1))}
                      >
                        Move up
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={index === facets.length - 1}
                        onClick={() => setFacets(current => moveItem(current, index, 1))}
                      >
                        Move down
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setFacets(current => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setFacets(current => [...current, { fieldId: '', variableName: '' }])
                  }
                >
                  Add facet
                </Button>
              </div>
              <div className={styles.hint}>
                Each variable is referenced as <code>$&lt;name&gt;</code> and holds the comma-joined
                selected ids.
              </div>
            </DialogSection>
          </>
        ) : (
          <>
            <DialogSection label="Entity schema">
              <select
                className={styles.selectInput}
                value={schemaName}
                onChange={event => setSchemaName(event.currentTarget.value)}
              >
                <option value="">Select a schema…</option>
                {(schemas.data ?? []).map(schema => (
                  <option key={schema.id} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </DialogSection>
            <DialogSection label="Variable name">
              <input
                type="text"
                className={styles.labelInput}
                placeholder="e.g. apiEntityId"
                value={variableName}
                onChange={event => setVariableName(event.currentTarget.value)}
              />
              <div className={styles.hint}>
                Referenced in widget config as <code>${variableName || '<name>'}</code>.
              </div>
            </DialogSection>
            <DialogSection label="List label" required={false}>
              <input
                type="text"
                className={styles.labelInput}
                placeholder="e.g. APIs"
                value={itemLabel}
                onChange={event => setItemLabel(event.currentTarget.value)}
              />
            </DialogSection>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
