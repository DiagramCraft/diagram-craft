import { Button } from '@diagram-craft/app-components/Button';
import { TbPencil } from 'react-icons/tb';
import { Title } from '../../components/Title';

export type DashboardHeaderDraft = { name: string; description: string };

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  canEdit: boolean;
  /** False when only the widget layout, not the name/description, can be edited. */
  detailsEditable?: boolean;
  isEditing: boolean;
  draft: DashboardHeaderDraft;
  onDraftChange: (draft: DashboardHeaderDraft) => void;
  onStartEditing: () => void;
};

export const DashboardHeader = (props: Props) => {
  const { draft, onDraftChange } = props;

  const editingDetails = props.isEditing && props.canEdit && (props.detailsEditable ?? true);

  return (
    <Title
      eyebrow={props.eyebrow}
      title={editingDetails ? draft.name : props.title}
      description={editingDetails ? draft.description : props.description}
      onTitleChange={editingDetails ? name => onDraftChange({ ...draft, name }) : undefined}
      onDescriptionChange={
        editingDetails ? description => onDraftChange({ ...draft, description }) : undefined
      }
      buttons={
        props.canEdit &&
        !props.isEditing && (
          <Button icon={<TbPencil size={12} />} onClick={props.onStartEditing}>
            Edit
          </Button>
        )
      }
    />
  );
};
