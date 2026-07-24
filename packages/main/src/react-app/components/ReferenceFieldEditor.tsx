import { useDocument } from '../../application';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { RelationshipDataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';

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

  const referencedSchema = db.schemas.find(s => s.id === field.schemaId);
  if (!referencedSchema) {
    return <div>Referenced schema not found</div>;
  }

  const referencedData = db.getData(referencedSchema);
  const displayField = referencedSchema.fields[0]?.id;

  const availableItems: MultiSelectItem[] = referencedData.map(item => {
    const fieldValue = displayField ? item[displayField] : undefined;
    let label: string = item._uid;

    if (fieldValue) {
      label = fieldValue;
    }

    return {
      value: item._uid,
      label: label
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <MultiSelect
        selectedValues={normalizedSelectedValues}
        availableItems={availableItems}
        onSelectionChange={onSelectionChange}
        placeholder={`Search ${referencedSchema.name}...`}
      />

      <div style={{ fontSize: '0.8em', color: 'var(--cmp-fg-dim)' }}>
        {field.minCount > 0 && `Minimum ${field.minCount} required. `}
        {field.maxCount < Number.MAX_SAFE_INTEGER && `Maximum ${field.maxCount} allowed.`}
        {normalizedSelectedValues.length > 0 && ` (${normalizedSelectedValues.length} selected)`}
      </div>
    </div>
  );
};
