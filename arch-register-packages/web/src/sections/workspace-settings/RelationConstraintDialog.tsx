import { Dialog } from '@diagram-craft/app-components/Dialog';
import type {
  RelationConstraintErrorData,
  RelationConstraintViolation
} from '@arch-register/api-types/relationSchemaContract';

const describeViolation = (violation: RelationConstraintViolation): string => {
  if (violation.kind === 'endpoint_pair_unique') {
    return `Relation schema '${violation.relation_schema_id}' has ${violation.existing_count} active relations for ordered pair (${violation.in_entity_id ?? 'unknown'}, ${violation.out_entity_id ?? 'unknown'}); enabling the constraint would project ${violation.projected_count}.`;
  }

  const limitLabel = violation.kind === 'typed_relation_minimum' ? 'minimum' : 'maximum';
  return `Typed relation field '${violation.field_name}' on the ${violation.direction} endpoint of relation schema '${violation.relation_schema_id}' would violate its ${limitLabel} of ${violation.limit} for entity '${violation.entity_id ?? 'unknown'}' (projected count: ${violation.projected_count}).`;
};

export const RelationConstraintDialog = ({
  data,
  onClose
}: {
  data: RelationConstraintErrorData | null;
  onClose: () => void;
}) => {
  if (!data) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Cannot enable relation constraint"
      buttons={[{ label: 'Close', type: 'default', onClick: onClose }]}
    >
      <p>
        Resolve the following existing or projected violations before saving. Relation field values
        are not included in this diagnostic.
      </p>
      <ul>
        {data.violations.map((violation, index) => (
          <li key={`${violation.kind}-${violation.relation_schema_id}-${index}`}>
            {describeViolation(violation)}
          </li>
        ))}
      </ul>
      {data.truncated && (
        <p>
          Showing {data.violations.length} of {data.total_violation_count} violations.{' '}
          {data.hidden_violation_count} additional violations are hidden.
        </p>
      )}
    </Dialog>
  );
};
