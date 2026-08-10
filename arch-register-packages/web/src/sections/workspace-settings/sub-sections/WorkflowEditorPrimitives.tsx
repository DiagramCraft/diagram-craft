import type { ReactNode } from 'react';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { StrategySection } from './WorkflowConfigHelpers';
import styles from './WorkflowsSubSection.module.css';

export const WorkflowBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.workflowBlock}>
    <div className={styles.workflowBlockTitle}>{title}</div>
    <div className={styles.workflowBlockFields}>{children}</div>
  </section>
);

export const StrategyEditor = ({
  label,
  strategies,
  section,
  fields,
  onChange
}: {
  label: string;
  strategies: GovernanceWorkflowCaseKind['approvalStrategies'];
  section: StrategySection;
  fields: Array<{ id: string; name: string; type: string }>;
  onChange: (patch: Partial<StrategySection>) => void;
}) => {
  const selectedId = section.strategy ?? strategies[0]?.id;
  const selected = strategies.find(strategy => strategy.id === selectedId);
  const fieldId = section.strategyConfig['fieldId'];

  return (
    <>
      <FormElement label={label}>
        <Select.Root
          value={selectedId}
          onChange={value => onChange({ strategy: value, strategyConfig: {} })}
          disabled={strategies.length === 1}
        >
          {strategies.map(strategy => (
            <Select.Item key={strategy.id} value={strategy.id}>
              {strategy.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      {selected?.configType === 'document-field' && (
        <FormElement label="Source field">
          <Select.Root
            value={typeof fieldId === 'string' ? fieldId : undefined}
            onChange={value => onChange({ strategyConfig: { fieldId: value } })}
            placeholder="Select a user or team field"
          >
            {fields.map(field => (
              <Select.Item key={field.id} value={field.id}>
                {field.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      )}
    </>
  );
};
