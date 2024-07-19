import { TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';

export const DirtyIndicator = (props: Props) => {
  if (!props.dirty) return null;

  return (
    <div
      style={{
        fontSize: '13px',
        color: 'var(--red-10)',
        display: 'flex',
        gap: '0.25rem',
        alignItems: 'center'
      }}
    >
      <div>Unsaved changes</div>
      <Button
        type={'icon-only'}
        style={{ padding: '1px 5px' }}
        onClick={() => props.onDirtyChange()}
      >
        <TbTrash size={'14px'} />
      </Button>
    </div>
  );
};

type Props = {
  dirty: boolean;
  onDirtyChange: () => void;
};
