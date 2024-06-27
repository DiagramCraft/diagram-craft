import { TbTrash } from 'react-icons/tb';

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
      <button
        className="cmp-button cmp-button--icon-only"
        style={{ padding: '1px 5px' }}
        onClick={() => props.onDirtyChange()}
      >
        <TbTrash size={'14px'} />
      </button>
    </div>
  );
};

type Props = {
  dirty: boolean;
  onDirtyChange: () => void;
};
