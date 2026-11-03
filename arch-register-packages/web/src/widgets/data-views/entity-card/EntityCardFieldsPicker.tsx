import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { STANDARD_FIELD_OPTIONS, STANDARD_FIELD_IDS } from './EntityCard';
import styles from './EntityCardFieldsPicker.module.css';

export const EntityCardFieldsPicker = ({
  schemaFields,
  selectedFields,
  onToggleField
}: {
  schemaFields: { id: string; name: string }[];
  selectedFields: string[];
  onToggleField: (fieldId: string) => void;
}) => (
  <FormCheckboxList columns={2}>
    {STANDARD_FIELD_OPTIONS.map(opt => (
      <FormCheckboxList.Row key={opt.id} label={opt.label}>
        <input
          type="checkbox"
          checked={selectedFields.includes(opt.id)}
          onChange={() => onToggleField(opt.id)}
        />
      </FormCheckboxList.Row>
    ))}
    {schemaFields.map(field => (
      <FormCheckboxList.Row
        key={field.id}
        className={STANDARD_FIELD_IDS.has(field.id) ? '' : styles.fieldOptionSchema}
        label={field.name}
      >
        <input
          type="checkbox"
          checked={selectedFields.includes(field.id)}
          onChange={() => onToggleField(field.id)}
        />
      </FormCheckboxList.Row>
    ))}
  </FormCheckboxList>
);
