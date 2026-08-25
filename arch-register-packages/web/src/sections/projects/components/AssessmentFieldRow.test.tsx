import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import type { WorkspaceContextType } from '../../../layouts/WorkspaceContext';
import { WorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { AssessmentFieldRow } from './AssessmentFieldRow';

const renderField = (field: AssessmentField) =>
  renderToStaticMarkup(
    <DialogContextProvider onDialogShow={() => undefined} onDialogHide={() => undefined}>
      <WorkspaceContext.Provider value={{ enums: [] } as unknown as WorkspaceContextType}>
        <AssessmentFieldRow
          field={field}
          groups={[{ id: 'governance', name: 'Governance' }]}
          onUpdate={() => undefined}
          onRemove={() => undefined}
          dragHandleRef={() => undefined}
        />
      </WorkspaceContext.Provider>
    </DialogContextProvider>
  );

describe('AssessmentFieldRow', () => {
  it('renders derived-field configuration and expression testing controls', () => {
    const markup = renderField({
      id: 'risk_score',
      label: 'Risk score',
      type: 'derived',
      requirementLevel: 'optional',
      expression: 'assessment.risk',
      resultType: 'number'
    });

    expect(markup).toContain('Result type');
    expect(markup).toContain('Expression');
    expect(markup).toContain('Derived');
  });

  it('renders inline enum configuration', () => {
    const markup = renderField({
      id: 'strategy',
      label: 'Strategy',
      type: 'enum',
      requirementLevel: 'required',
      options: [{ value: 'retain', label: 'Retain' }]
    });

    expect(markup).toContain('Source');
    expect(markup).toContain('Inline values');
  });
});
