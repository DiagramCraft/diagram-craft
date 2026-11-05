import { useDraft } from '../useDraft';
import { MutationError } from '../MutationError';
import { SaveBarButtons } from '../SaveBarButtons';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentType } from '@arch-register/api-types/workspaceConfigContract';
import { useUpdateAssessmentTypes } from '../../../hooks/useWorkspaceConfig';
import { SettingsBlock } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';
import { ListEditor } from '../../../components/ListEditor';

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
  const { draft: types, setDraft: setTypes, dirty, reset } = useDraft(assessmentTypes, toDraft);
  const mutation = useUpdateAssessmentTypes(workspaceId);

  const save = async () => {
    try {
      await mutation.mutateAsync(types.map((type, index) => ({ ...type, sort_order: index })));
    } catch {
      // The error is surfaced below through the mutation state
    }
  };

  return (
    <>
      <SectionActions>
        <SaveBarButtons dirty={dirty} pending={mutation.isPending} onCancel={reset} onSave={save} />
      </SectionActions>
      <MutationError error={mutation.error} />
      <SettingsBlock
        title="Assessment types"
        description="Categorize assessments for dashboards and future assessment views. Removing a type uncategorizes existing assessments that used it."
      >
        <ListEditor
          items={types}
          onChange={setTypes}
          getId={type => type.id}
          createItem={() => ({ id: crypto.randomUUID(), name: '' })}
          addLabel="Add assessment type"
          removeLabel="Delete type"
          renderItem={(type, { update }) => (
            <TextInput
              value={type.name}
              onChange={value => update({ name: value ?? '' })}
              placeholder="Name (e.g. Risk & compliance)"
            />
          )}
        />
      </SettingsBlock>
    </>
  );
};
