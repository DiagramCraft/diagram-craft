import { STANDARD_FIELD_OPTIONS, STANDARD_FIELD_IDS } from './EntityCard';
import styles from './EntityCardDialog.module.css';

export const EntityCardFieldsPicker = ({
  schemaFields,
  selectedFields,
  onToggleField
}: {
  schemaFields: { id: string; name: string }[];
  selectedFields: string[];
  onToggleField: (fieldId: string) => void;
}) => (
  <div className={styles.fieldGrid}>
    {STANDARD_FIELD_OPTIONS.map(opt => (
      <label key={opt.id} className={styles.fieldOption}>
        <input
          type="checkbox"
          checked={selectedFields.includes(opt.id)}
          onChange={() => onToggleField(opt.id)}
        />
        {opt.label}
      </label>
    ))}
    {schemaFields.map(field => (
      <label
        key={field.id}
        className={`${styles.fieldOption} ${STANDARD_FIELD_IDS.has(field.id) ? '' : styles.fieldOptionSchema}`}
      >
        <input
          type="checkbox"
          checked={selectedFields.includes(field.id)}
          onChange={() => onToggleField(field.id)}
        />
        {field.name}
      </label>
    ))}
  </div>
);
