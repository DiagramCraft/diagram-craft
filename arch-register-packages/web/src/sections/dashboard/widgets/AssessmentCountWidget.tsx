import { useMemo } from 'react';
import { useAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { filterAssessments, assessmentWidgetModeSchema } from './assessmentsWidgetLogic';
import { resolveScopeSchemaIds } from './AssessmentsWidget';
import styles from './AggregateStatWidget.module.css';
import { useWidgetBodyTitle } from './WidgetBodyTitle';
import { Select } from '@diagram-craft/app-components/Select';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { AssessmentWidgetMode } from './assessmentsWidgetLogic';
import registrationStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const assessmentCountWidgetConfigSchema = z.object({
  mode: withInitial(assessmentWidgetModeSchema, 'active'),
  assessmentTypeId: z.string().optional(),
  /** Entity schema names; counts assessments scoped to any of them. */
  schemaNames: z.array(z.string()).optional(),
  /** Counts open assessments due within this many days, overdue ones included. */
  dueWithinDays: z.number().optional(),
  subtext: z.string().optional()
});

export type AssessmentCountWidgetConfig = z.infer<typeof assessmentCountWidgetConfigSchema>;

type Props = {
  config: AssessmentCountWidgetConfig;
};

/** Stat tile counting assessments (workspace-wide) by scope, mode and due window. */
export const AssessmentCountWidget = ({ config }: Props) => {
  const title = useWidgetBodyTitle();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: assessments = [], isLoading } = useAssessments(workspaceSlug, true);

  const count = useMemo(
    () =>
      filterAssessments(assessments, {
        mode: config.mode,
        assessmentTypeId: config.assessmentTypeId,
        scopeSchemaIds: resolveScopeSchemaIds(config.schemaNames, schemas),
        dueWithinDays: config.dueWithinDays
      }).length,
    [
      assessments,
      config.assessmentTypeId,
      config.dueWithinDays,
      config.mode,
      config.schemaNames,
      schemas
    ]
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.number}>{count}</div>
      {title && <div className={styles.label}>{title}</div>}
      {config.subtext && <div className={styles.sub}>{config.subtext}</div>}
    </div>
  );
};

export const ASSESSMENT_COUNT_TYPE = 'AssessmentCount' as const;

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

export const AssessmentCountConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentCountWidgetConfig;
  onChange: (config: AssessmentCountWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const selected = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked ? [...selected, name] : selected.filter(existing => existing !== name);
    onChange({ ...config, schemaNames: next.length === 0 ? undefined : next });
  };

  return (
    <>
      <DialogSection label="Mode" required>
        <Select.Root
          value={config.mode}
          onChange={value =>
            onChange({ ...config, mode: (value ?? 'active') as AssessmentWidgetMode })
          }
        >
          <Select.Item value="active">Active</Select.Item>
          <Select.Item value="upcoming">Upcoming</Select.Item>
          <Select.Item value="overdue">Overdue</Select.Item>
          <Select.Item value="all">All</Select.Item>
        </Select.Root>
      </DialogSection>
      <DialogSection label="Scoped to entity types" required={false}>
        <div className={registrationStyles.options}>
          {schemas.map(schema => (
            <label key={schema.id} className={registrationStyles.optionRow}>
              <input
                type="checkbox"
                checked={selected.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
              <span className={registrationStyles.optionLabel}>{schema.name}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={registrationStyles.options}>
          <label className={registrationStyles.optionRow}>
            <span className={registrationStyles.optionLabel}>Due within (days)</span>
            <div className={registrationStyles.optionControl}>
              <input
                type="number"
                min={0}
                className={registrationStyles.labelInput}
                value={config.dueWithinDays ?? ''}
                placeholder="Any"
                onChange={event => {
                  const value = event.currentTarget.value;
                  onChange({ ...config, dueWithinDays: value === '' ? undefined : Number(value) });
                }}
              />
            </div>
          </label>
          <label className={registrationStyles.optionRow}>
            <span className={registrationStyles.optionLabel}>Subtext</span>
            <div className={registrationStyles.optionControl}>
              <input
                type="text"
                className={registrationStyles.labelInput}
                value={config.subtext ?? ''}
                onChange={event =>
                  onChange({ ...config, subtext: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
