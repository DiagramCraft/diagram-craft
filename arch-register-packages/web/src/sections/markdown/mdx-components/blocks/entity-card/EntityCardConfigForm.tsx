import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { EntityPicker } from '../../../../../components/EntityPicker';
import { DialogSection } from '../../../editor/BlockDialog';
import { DEFAULT_FIELDS, filterSchemaFields } from './EntityCard';
import { EntityCardFieldsPicker } from './EntityCardFieldsPicker';
import type { EntityCardWidgetConfig } from './types';

type Props = {
  config: EntityCardWidgetConfig;
  onChange: (config: EntityCardWidgetConfig) => void;
  context: { workspaceSlug: string };
};

export const EntityCardConfigForm = ({ config, onChange, context }: Props) => {
  const { schemas } = useWorkspaceContext();
  const { data: entity } = useEntity(context.workspaceSlug, config.entityId);
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
      <DialogSection label="Entity">
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
      </DialogSection>
      {config.entityId && (
        <DialogSection label="Fields" required={false}>
          <EntityCardFieldsPicker
            schemaFields={schemaFields}
            selectedFields={fields}
            onToggleField={toggleField}
          />
        </DialogSection>
      )}
    </>
  );
};
