import { useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateAssessmentTypes } from '../../../hooks/useWorkspaceConfig';
import styles from './LifecycleSubSection.module.css';

type DraftAssessmentType = Pick<AssessmentType, 'id' | 'name' | 'is_active'>;

const toDraft = (types: AssessmentType[]): DraftAssessmentType[] =>
  types.map(type => ({ id: type.id, name: type.name, is_active: type.is_active }));

export const AssessmentTypesSubSection = ({
  workspaceId,
  assessmentTypes
}: {
  workspaceId: string;
  assessmentTypes: AssessmentType[];
}) => {
  const [types, setTypes] = useState<DraftAssessmentType[]>(() => toDraft(assessmentTypes));
  const mutation = useUpdateAssessmentTypes(workspaceId);

  useEffect(() => setTypes(toDraft(assessmentTypes)), [assessmentTypes]);

  const initial = toDraft(assessmentTypes);
  const dirty = JSON.stringify(types) !== JSON.stringify(initial);

  const save = async () => {
    await mutation.mutateAsync(types.map((type, index) => ({ ...type, sort_order: index })));
  };

  return (
    <div className={styles.blockList}>
      <div className={styles.sectionActions}>
        <Button disabled={!dirty || mutation.isPending} onClick={() => setTypes(initial)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!dirty || mutation.isPending}
          onClick={() => void save()}
        >
          {mutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Assessment types</div>
          <div className={styles.sectionSub}>
            Categorize assessments for dashboards and future assessment views. Inactive types remain
            available on existing assessments.
          </div>
        </div>
        <div className={styles.sectionBody}>
          {types.map((type, index) => (
            <div
              key={type.id}
              className={styles.field}
              style={{ gridTemplateColumns: '1fr auto auto' }}
            >
              <TextInput
                value={type.name}
                onChange={value =>
                  setTypes(current =>
                    current.map((item, i) => (i === index ? { ...item, name: value ?? '' } : item))
                  )
                }
                placeholder="Name (e.g. Risk & compliance)"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={type.is_active}
                  onChange={event =>
                    setTypes(current =>
                      current.map((item, i) =>
                        i === index ? { ...item, is_active: event.target.checked } : item
                      )
                    )
                  }
                />
                Active
              </label>
              <Button
                onClick={() =>
                  setTypes(current =>
                    current.map((item, i) => (i === index ? { ...item, is_active: false } : item))
                  )
                }
                style={{ padding: '0 6px' }}
                title="Deactivate type"
              >
                <TbTrash size={12} />
              </Button>
            </div>
          ))}
          <Button
            icon={<TbPlus size={12} />}
            onClick={() =>
              setTypes(current => [
                ...current,
                { id: crypto.randomUUID(), name: '', is_active: true }
              ])
            }
            style={{ marginTop: 8 }}
          >
            Add assessment type
          </Button>
        </div>
      </div>
    </div>
  );
};
