import { useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateAssessmentTypes } from '../../../hooks/useWorkspaceConfig';
import styles from './LifecycleSubSection.module.css';

type DraftAssessmentType = Pick<AssessmentType, 'id' | 'name'>;

const toDraft = (types: AssessmentType[]): DraftAssessmentType[] =>
  types.map(type => ({ id: type.id, name: type.name }));

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
            Categorize assessments for dashboards and future assessment views. Removing a type
            uncategorizes existing assessments that used it.
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
              <Button
                onClick={() => setTypes(current => current.filter((_, i) => i !== index))}
                style={{ padding: '0 6px' }}
                title="Delete type"
              >
                <TbTrash size={12} />
              </Button>
            </div>
          ))}
          <Button
            icon={<TbPlus size={12} />}
            onClick={() => setTypes(current => [...current, { id: crypto.randomUUID(), name: '' }])}
            style={{ marginTop: 8 }}
          >
            Add assessment type
          </Button>
        </div>
      </div>
    </div>
  );
};
