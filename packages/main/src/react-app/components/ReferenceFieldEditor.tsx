import { useDocument } from '../../application';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import {
  getRelationshipSchemaIds,
  RelationshipDataSchemaField
} from '@diagram-craft/model/diagramDocumentDataSchemas';

type ReferenceFieldEditorProps = {
  field: RelationshipDataSchemaField;
  selectedValues?: string[];
  onSelectionChange: (values: string[]) => void;
};

export const ReferenceFieldEditor = ({
  field,
  selectedValues,
  onSelectionChange
}: ReferenceFieldEditorProps) => {
  const document = useDocument();
  const db = document.data.db;
  const normalizedSelectedValues = selectedValues ?? [];

  const referencedSchemas = getRelationshipSchemaIds(field)
    .map(schemaId => db.schemas.find(schema => schema.id === schemaId))
    .filter((schema): schema is (typeof db.schemas)[number] => schema !== undefined);
  if (referencedSchemas.length === 0) {
    return <div>Referenced schema not found</div>;
  }

  const availableItems: MultiSelectItem[] = referencedSchemas.flatMap(referencedSchema => {
    const displayField = referencedSchema.fields[0]?.id;
    return db.getData(referencedSchema).map(item => ({
      value: item._uid,
      label: (displayField ? item[displayField] : undefined) ?? item._uid
    }));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <MultiSelect
        selectedValues={normalizedSelectedValues}
        availableItems={availableItems}
        onSelectionChange={onSelectionChange}
        placeholder={`Search ${referencedSchemas.map(schema => schema.name).join(', ')}...`}
      />

      <div style={{ fontSize: '0.8em', color: 'var(--cmp-fg-dim)' }}>
        {field.minCount > 0 && `Minimum ${field.minCount} required. `}
        {field.maxCount < Number.MAX_SAFE_INTEGER && `Maximum ${field.maxCount} allowed.`}
        {normalizedSelectedValues.length > 0 && ` (${normalizedSelectedValues.length} selected)`}
      </div>
    </div>
  );
};
