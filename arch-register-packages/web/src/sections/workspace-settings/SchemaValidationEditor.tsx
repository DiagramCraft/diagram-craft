import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import { ValidationRulesEditor } from './ValidationRulesEditor';

export const SchemaValidationEditor = (props: {
  rules: ValidationRule[];
  canEdit: boolean;
  previewPending: boolean;
  previewMessage: string | null;
  onPreview: () => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ValidationRule>) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) => <ValidationRulesEditor {...props} />;
