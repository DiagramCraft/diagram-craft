import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { isScalarCardinalityField, scalarCardinalityPatchForMin } from './scalarCardinality';

export const ScalarCardinalityControls = ({
  field,
  onUpdate,
  disabled = false
}: {
  field: SchemaField;
  onUpdate: (patch: Partial<SchemaField>) => void;
  disabled?: boolean;
}) => {
  if (!isScalarCardinalityField(field)) return null;

  const updateMin = (value: string | undefined) => {
    const raw = value ?? '';
    if (raw.trim() === '') {
      onUpdate(scalarCardinalityPatchForMin(field, 0));
      return;
    }
    const next = Number(raw);
    if (Number.isInteger(next) && next >= 0) onUpdate(scalarCardinalityPatchForMin(field, next));
  };

  const updateMax = (value: string | undefined) => {
    const raw = value ?? '';
    onUpdate({
      maxCardinality:
        raw.trim() === ''
          ? -1
          : Number.isInteger(Number(raw)) && Number(raw) >= 0
            ? Number(raw)
            : field.maxCardinality
    });
  };

  return (
    <>
      <FormElement label="Min values">
        <TextInput
          value={String(field.minCardinality ?? 0)}
          disabled={disabled}
          onChange={updateMin}
          placeholder="0"
        />
      </FormElement>
      <FormElement label="Max values">
        <TextInput
          value={field.maxCardinality === -1 ? '' : String(field.maxCardinality ?? 1)}
          disabled={disabled}
          onChange={updateMax}
          placeholder="Unlimited"
        />
      </FormElement>
    </>
  );
};
