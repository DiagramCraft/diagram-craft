import { Fragment, useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateAssessmentTypes } from '../../../hooks/useWorkspaceConfig';
import { SettingsBlock, SettingsBlockList } from '../SettingsBlock';
import { WorkspaceSettingsSectionHeader } from '../WorkspaceSettingsSectionHeader';
import styles from './AssessmentTypesSubSection.module.css';

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
    <>
      <WorkspaceSettingsSectionHeader
        section="assessment-types"
        buttons={
          <>
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
          </>
        }
      />
      <SettingsBlockList>
        <SettingsBlock
          title="Assessment types"
          description="Categorize assessments for dashboards and future assessment views. Removing a type uncategorizes existing assessments that used it."
        >
          <div className={styles.fieldGrid}>
            {types.map((type, index) => (
              <Fragment key={type.id}>
                <TextInput
                  value={type.name}
                  onChange={value =>
                    setTypes(current =>
                      current.map((item, i) =>
                        i === index ? { ...item, name: value ?? '' } : item
                      )
                    )
                  }
                  placeholder="Name (e.g. Risk & compliance)"
                />
                <Button
                  onClick={() => setTypes(current => current.filter((_, i) => i !== index))}
                  variant="danger"
                  style={{ marginLeft: '1rem' }}
                  title="Delete type"
                >
                  <TbTrash size={12} />
                </Button>
                {index < types.length - 1 && <div className={styles.divider} />}
              </Fragment>
            ))}
          </div>
          <Button
            icon={<TbPlus size={12} />}
            onClick={() => setTypes(current => [...current, { id: crypto.randomUUID(), name: '' }])}
          >
            Add assessment type
          </Button>
        </SettingsBlock>
      </SettingsBlockList>
    </>
  );
};
