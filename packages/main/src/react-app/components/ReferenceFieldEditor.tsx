import { useDocument } from '../../application';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';

type ReferenceFieldEditorProps = {
  field: DataSchemaField & { type: 'reference' };
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
};

export const ReferenceFieldEditor = ({
  field,
  selectedValues,
  onSelectionChange
}: ReferenceFieldEditorProps) => {
  const document = useDocument();
  const db = document.data.db;

  const referencedSchema = db.schemas.find(s => s.id === field.schemaId);
  if (!referencedSchema) {
    return <div>Referenced schema not found</div>;
  }

  const referencedData = db.getData(referencedSchema);
  const displayField = referencedSchema.fields[0]!.id;

  const availableItems: MultiSelectItem[] = referencedData.map(item => {
    const fieldValue = item[displayField];
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
        selectedValues={selectedValues}
        availableItems={availableItems}
        onSelectionChange={onSelectionChange}
        placeholder={`Search ${referencedSchema.name}...`}
      />

      <div style={{ fontSize: '0.8em', color: 'var(--cmp-fg-dim)' }}>
        {field.minCount > 0 && `Minimum ${field.minCount} required. `}
        {field.maxCount < Number.MAX_SAFE_INTEGER && `Maximum ${field.maxCount} allowed.`}
        {selectedValues.length > 0 && ` (${selectedValues.length} selected)`}
      </div>
    </div>
  );
};
