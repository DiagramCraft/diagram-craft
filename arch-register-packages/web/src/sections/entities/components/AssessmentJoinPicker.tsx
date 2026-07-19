import { useRef } from 'react';
import { TbCheck, TbStars } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { AssessmentJoinOption } from './useJoinedAssessment';
import filterStyles from '../../../components/FilterBuilder.module.css';
import styles from './EntityBrowser.module.css';

export const AssessmentJoinPicker = ({
  options,
  value,
  onChange
}: {
  options: AssessmentJoinOption[];
  value: string | null;
  onChange: (assessmentId: string | null) => void;
}) => {
  const actionsRef = useRef<PopoverActions | null>(null);
  const groups = new Map<string, AssessmentJoinOption[]>();
  for (const option of options) {
    const group = option.projectName ?? 'Other';
    groups.set(group, [...(groups.get(group) ?? []), option]);
  }
  const selected = options.find(o => o.assessment.id === value) ?? null;
  const select = (assessmentId: string | null) => {
    onChange(assessmentId);
    actionsRef.current?.close();
  };

  return (
    <Popover.Root actionsRef={actionsRef}>
      <Popover.Trigger
        element={
          <Button
            size="sm"
            variant={value ? 'primary' : 'secondary'}
            disabled={options.length === 0}
            title={options.length === 0 ? 'No open or closed assessments found' : undefined}
          >
            <TbStars size={12} style={{ marginRight: 4 }} />
            {selected ? selected.assessment.name : 'Assessment'}
          </Button>
        }
      />
      <Popover.Content
        sideOffset={4}
        align="start"
        arrow={false}
        closeButton={false}
        className={styles.filterPopover}
      >
        <div className={filterStyles.container} style={{ width: 260 }}>
          <div className={filterStyles.header}>
            <span className={filterStyles.headerTitle}>Assessment</span>
            {value != null && (
              <button type="button" className={filterStyles.clearAll} onClick={() => select(null)}>
                Clear
              </button>
            )}
          </div>
          <div className={styles.assessmentList}>
            {[...groups].map(([group, groupOptions]) => (
              <div key={group} className={styles.fieldsGroup}>
                <div className={styles.fieldsGroupLabel}>{group}</div>
                {groupOptions.map(option => (
                  <button
                    key={option.assessment.id}
                    type="button"
                    className={`${styles.assessmentOption}${
                      value === option.assessment.id ? ` ${styles.assessmentOptionActive}` : ''
                    }`}
                    onClick={() => select(option.assessment.id)}
                  >
                    <span className={styles.assessmentOptionCheck}>
                      {value === option.assessment.id && <TbCheck size={12} />}
                    </span>
                    {option.assessment.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
