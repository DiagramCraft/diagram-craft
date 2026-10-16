import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { ConfigFormProps } from '../../shared/types';
import { useEntity } from '../../../hooks/useEntities';
import { EntityPicker } from '../../../components/EntityPicker';
import { FormGroup } from '../../../components/FormGroup';
import { DEFAULT_FIELDS, filterSchemaFields } from './EntityCard';
import { EntityCardFieldsPicker } from './EntityCardFieldsPicker';
import type { EntityCardWidgetConfig } from './types';

type Props = ConfigFormProps<EntityCardWidgetConfig>;

export const EntityCardConfigForm = ({ config, onChange }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: entity } = useEntity(workspaceSlug, config.entityId);
  const schema = schemas.find(s => s.id === entity?._schema?.id);
  const schemaFields = filterSchemaFields(schema?.fields ?? []);
  const fields = config.fields ? config.fields.split(',').filter(Boolean) : DEFAULT_FIELDS;

  const toggleField = (fieldId: string) => {
    const next = fields.includes(fieldId)
      ? fields.filter(f => f !== fieldId)
      : [...fields, fieldId];
    onChange({ ...config, fields: next.join(',') });
  };

  return (
    <>
      <FormGroup label="Entity" variant="simple">
        <EntityPicker
          selectedEntityId={config.entityId}
          selectedEntity={entity}
          onSelectEntity={selected =>
            onChange({
              entityId: selected._publicId,
              fields: config.fields ?? DEFAULT_FIELDS.join(',')
            })
          }
          onClearEntity={() => onChange({ ...config, entityId: '' })}
        />
      </FormGroup>
      {config.entityId && (
        <FormGroup label="Fields" supplementaryLabel="(optional)" variant="simple">
          <EntityCardFieldsPicker
            schemaFields={schemaFields}
            selectedFields={fields}
            onToggleField={toggleField}
          />
        </FormGroup>
      )}
    </>
  );
};
