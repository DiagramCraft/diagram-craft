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
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import { ListEditor } from '../../components/ListEditor';
import { DialogContent } from '../markdown/editor/BlockDialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  isFacetsConfigValid,
  isOptionsConfigValid,
  isValidVariableName,
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
  const entitySchemas = useSchemas(workspaceSlug);
  const relationSchemas = useRelationSchemas(workspaceSlug);
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

  const [facetsSchemaKind, setFacetsSchemaKind] = useState<'entity' | 'relation'>(
    facetsSidebar?.schemaKind ?? 'entity'
  );
  const schemas = facetsSchemaKind === 'relation' ? relationSchemas : entitySchemas;
  const facetableSchemas = (schemas.data ?? []) as {
    id: string;
    name: string;
    fields: Parameters<typeof facetKindForField>[0][];
  }[];

  const referenceFieldNames = facetableSchemas
    .find(schema => schema.name === facetsSchemaName)
    ?.fields.filter(field => facetKindForField(field) !== undefined)
    .map(field => field.name);

  const changeFacetsSchema = (value: string) => {
    const nextKind = value.startsWith('relation:') ? 'relation' : 'entity';
    const name = value.replace(/^(entity|relation):/, '');
    setFacetsSchemaKind(nextKind);
    setFacetsSchemaName(name);
    const names = (
      ((nextKind === 'relation' ? relationSchemas : entitySchemas).data ?? []) as {
        name: string;
        fields: Parameters<typeof facetKindForField>[0][];
      }[]
    )
      .find(schema => schema.name === name)
      ?.fields.filter(field => facetKindForField(field) !== undefined)
      .map(field => field.name);
    setFacets(current =>
      current.map(f =>
        f.fieldId.startsWith('_') || names?.includes(f.fieldId) ? f : { ...f, fieldId: '' }
      )
    );
  };

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
                    ...(facetsSchemaKind === 'relation' ? { schemaKind: 'relation' as const } : {}),
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
        <FormElement label="Sidebar type">
          <Select.Root
            value={kind}
            onChange={value => value && setKind(value as DashboardSidebarConfig['kind'])}
          >
            <Select.Item value="entity-picker">Entity picker (single select)</Select.Item>
            <Select.Item value="facets">Facets (multi select)</Select.Item>
            <Select.Item value="options">Fixed options (single select)</Select.Item>
          </Select.Root>
        </FormElement>
        {kind === 'options' ? (
          <>
            <FormElement label="Variable name">
              <TextInput
                placeholder="e.g. status"
                value={optionsVariableName}
                onChange={value => setOptionsVariableName(value ?? '')}
              />
              <div className={styles.hint}>
                Referenced in widget config as <code>${optionsVariableName || '<name>'}</code>. It
                is empty when nothing is selected.
              </div>
            </FormElement>
            <FormElement label="List label" required={false}>
              <TextInput
                value={optionsItemLabel}
                onChange={value => setOptionsItemLabel(value ?? '')}
              />
            </FormElement>
            <FormElement label="“All” row label" required={false}>
              <TextInput
                placeholder="e.g. All (leave empty for no “All” row)"
                value={optionsAllLabel}
                onChange={value => setOptionsAllLabel(value ?? '')}
              />
            </FormElement>
            <ListEditor
              label="Options"
              items={options}
              onChange={setOptions}
              createItem={() => ({ value: '', label: '' })}
              addLabel="Add option"
              layout="card"
              reorder="drag"
              renderItem={(option, { update }) => (
                <div className={styles.options}>
                  <TextInput
                    placeholder="Value"
                    value={option.value}
                    onChange={value => update({ value: value ?? '' })}
                  />
                  <TextInput
                    placeholder="Label"
                    value={option.label}
                    onChange={value => update({ label: value ?? '' })}
                  />
                </div>
              )}
            />
          </>
        ) : kind === 'facets' ? (
          <>
            <FormElement label="Schema">
              <Select.Root
                value={facetsSchemaName ? `${facetsSchemaKind}:${facetsSchemaName}` : undefined}
                placeholder="Select a schema…"
                onChange={value => changeFacetsSchema(value ?? '')}
              >
                {(entitySchemas.data ?? []).map(schema => (
                  <Select.Item key={`entity:${schema.id}`} value={`entity:${schema.name}`}>
                    {`Entity schema · ${schema.name}`}
                  </Select.Item>
                ))}
                {(relationSchemas.data ?? []).map(schema => (
                  <Select.Item key={`relation:${schema.id}`} value={`relation:${schema.name}`}>
                    {`Relation type · ${schema.name}`}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <ListEditor
              label="Facets"
              items={facets}
              onChange={setFacets}
              createItem={(): DashboardFacetConfig => ({ fieldId: '', variableName: '' })}
              addLabel="Add facet"
              layout="card"
              reorder="drag"
              renderItem={(facet, { update }) => (
                <div className={styles.options}>
                  <Select.Root
                    value={facet.fieldId || undefined}
                    placeholder="Select a field…"
                    onChange={value => update({ fieldId: value ?? '' })}
                  >
                    <Select.Item value="_owner">Owner</Select.Item>
                    <Select.Item value="_lifecycle">Lifecycle</Select.Item>
                    {(referenceFieldNames ?? []).map(name => (
                      <Select.Item key={name} value={name}>
                        {name}
                      </Select.Item>
                    ))}
                  </Select.Root>
                  <TextInput
                    placeholder="Variable name, e.g. category"
                    value={facet.variableName}
                    onChange={value => update({ variableName: value ?? '' })}
                  />
                  <TextInput
                    placeholder="Label (optional)"
                    value={facet.itemLabel ?? ''}
                    onChange={value => update({ itemLabel: value ?? '' })}
                  />
                </div>
              )}
            />
          </>
        ) : (
          <>
            <FormElement label="Entity schema">
              <Select.Root
                value={schemaName || undefined}
                placeholder="Select a schema…"
                onChange={value => setSchemaName(value ?? '')}
              >
                {(entitySchemas.data ?? []).map(schema => (
                  <Select.Item key={schema.id} value={schema.name}>
                    {schema.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <FormElement label="Variable name">
              <TextInput
                placeholder="e.g. apiEntityId"
                value={variableName}
                onChange={value => setVariableName(value ?? '')}
              />
              <div className={styles.hint}>
                Referenced in widget config as <code>${variableName || '<name>'}</code>.
              </div>
            </FormElement>
            <FormElement label="List label" required={false}>
              <TextInput
                placeholder="e.g. APIs"
                value={itemLabel}
                onChange={value => setItemLabel(value ?? '')}
              />
            </FormElement>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
