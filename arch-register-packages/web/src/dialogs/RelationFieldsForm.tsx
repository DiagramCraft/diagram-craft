import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { RelationFieldGroupSection } from '../components/RelationFieldGroupSection';
import { groupRelationFields } from '../lib/relationFieldGroups';
import { RelationFieldInput, isMultiValuedRelationSelectField } from './RelationFieldInput';

type RelationField = RelationSchema['fields'][number];
export type RelationFieldValues = Record<string, string | string[]>;

export const emptyRelationFieldValue = (field: RelationField) =>
  field.type === 'entityRelation' || isMultiValuedRelationSelectField(field) ? [] : '';

/** The inputs for a relation's own fields, laid out in the schema's field groups. */
export const RelationFieldsForm = ({
  workspaceId,
  fields,
  groups,
  values,
  onChange,
  disabled
}: {
  workspaceId: string;
  fields: RelationField[];
  groups: RelationSchema['groups'] | undefined;
  values: RelationFieldValues;
  onChange: (fieldId: string, value: string | string[]) => void;
  disabled?: boolean;
}) => (
  <>
    {groupRelationFields(fields, groups).map(segment => {
      const inputs = segment.fields.map(field => (
        <RelationFieldInput
          key={field.id}
          workspaceId={workspaceId}
          field={field}
          value={values[field.id] ?? emptyRelationFieldValue(field)}
          disabled={disabled}
          onChange={value => onChange(field.id, value)}
        />
      ));
      return segment.group ? (
        <RelationFieldGroupSection
          key={segment.group.id}
          name={segment.group.name}
          description={segment.group.description}
        >
          {inputs}
        </RelationFieldGroupSection>
      ) : (
        inputs
      );
    })}
  </>
);
