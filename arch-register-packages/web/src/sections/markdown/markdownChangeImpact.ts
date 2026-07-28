export type WorkflowDocumentField = {
  isStatus?: boolean;
  retired?: boolean;
};

export const hasWorkflowFields = (fields: readonly WorkflowDocumentField[]) =>
  fields.some(field => field.isStatus === true && !field.retired);
