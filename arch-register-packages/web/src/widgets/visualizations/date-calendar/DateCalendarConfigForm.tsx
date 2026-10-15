import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { KNOWN_CASE_KINDS } from '../../data-views/needs-attention/NeedsAttentionConfigForm';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { DateCalendarWidgetConfig } from './types';

type DateCalendarConfigFormProps = {
  config: DateCalendarWidgetConfig;
  onChange: (config: DateCalendarWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

const CaseSourceForm = ({ config, onChange }: DateCalendarConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const cases = config.cases!;
  const patch = (next: Partial<NonNullable<DateCalendarWidgetConfig['cases']>>) =>
    onChange({ ...config, cases: { ...cases, ...next } });
  return (
    <>
      <DialogSection label="Entity type">
        <select
          className={configFormStyles.labelInput}
          value={cases.schemaName}
          onChange={e => patch({ schemaName: e.target.value })}
        >
          <option value="">Choose an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Case kinds">
        <div className={configFormStyles.options}>
          {KNOWN_CASE_KINDS.map(kind => (
            <label key={kind} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={cases.caseKinds.includes(kind)}
                onChange={e =>
                  patch({
                    caseKinds: e.target.checked
                      ? [...cases.caseKinds, kind]
                      : cases.caseKinds.filter(existing => existing !== kind)
                  })
                }
              />
              <span className={configFormStyles.optionLabel}>{humanizeCaseKind(kind)}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Scope" required={false}>
        <select
          className={configFormStyles.labelInput}
          value={cases.scope ?? 'workspace'}
          onChange={e => patch({ scope: e.target.value as 'workspace' | 'mine' | 'late' })}
        >
          <option value="workspace">Workspace-wide</option>
          <option value="mine">Assigned to me</option>
          <option value="late">Past due</option>
        </select>
      </DialogSection>
    </>
  );
};

export const DateCalendarConfigForm = ({ config, onChange }: DateCalendarConfigFormProps) => (
  <>
    <DialogSection label="Source" required={false}>
      <select
        className={configFormStyles.labelInput}
        value={config.cases ? 'cases' : 'query'}
        onChange={e =>
          onChange({
            ...config,
            cases:
              e.target.value === 'cases'
                ? {
                    schemaName: '',
                    caseKinds: ['entity.change-case', 'entity.deprecation']
                  }
                : undefined
          })
        }
      >
        <option value="query">Records (query)</option>
        <option value="cases">Governance cases (by due date)</option>
      </select>
    </DialogSection>
    {config.cases ? (
      <CaseSourceForm config={config} onChange={onChange} />
    ) : (
      <>
        <DialogSection label="Records (query)" required={config.entityQuery === undefined}>
          <input
            type="text"
            className={configFormStyles.labelInput}
            value={config.query ?? ''}
            placeholder='e.g. schema:"Contract"'
            onChange={e => onChange({ ...config, query: e.target.value })}
          />
        </DialogSection>
        <DialogSection label="Date field id" required>
          <input
            type="text"
            className={configFormStyles.labelInput}
            value={config.dateFieldId}
            placeholder="e.g. contract_end"
            onChange={e => onChange({ ...config, dateFieldId: e.target.value })}
          />
        </DialogSection>
      </>
    )}
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Period</span>
          <div className={configFormStyles.optionControl}>
            <select
              value={config.period ?? 'month'}
              onChange={e =>
                onChange({
                  ...config,
                  period: e.target.value === 'week' ? 'week' : 'month'
                })
              }
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Number of periods</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={configFormStyles.labelInput}
              value={config.periodCount ?? 12}
              onChange={e =>
                onChange({
                  ...config,
                  periodCount: Math.max(1, optionalNumber(e.target.value) ?? 12)
                })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Subtitle field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.sublabelFieldId ?? ''}
              onChange={e =>
                onChange({
                  ...config,
                  sublabelFieldId: optionalText(e.target.value)
                })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Value field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.valueFieldId ?? ''}
              onChange={e =>
                onChange({
                  ...config,
                  valueFieldId: optionalText(e.target.value)
                })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Warn within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.warnWithinDays ?? ''}
              placeholder="30"
              onChange={e =>
                onChange({
                  ...config,
                  warnWithinDays: optionalNumber(e.target.value)
                })
              }
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
