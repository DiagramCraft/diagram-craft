import { Chip } from '../../components/Chip';
import { useSchemaDraftState, type SchemaDraftKind } from './useSchemaDraftState';

export const DRAFT_ATTENTION_COLOR = 'var(--warning-fg)';

/** Attention-colored pill shown next to an editor's title while the item is staged in the draft. */
export const DraftPill = ({ kind, id }: { kind: SchemaDraftKind; id: string | undefined }) => {
  const { itemFor } = useSchemaDraftState();
  const staged = id ? itemFor(kind, id) : undefined;
  if (!staged) return null;
  const label =
    staged.op === 'create'
      ? 'New in draft'
      : staged.op === 'delete'
        ? 'Deleted in draft'
        : 'Changed in draft';
  return (
    <span data-testid="editor-draft-badge">
      <Chip color={DRAFT_ATTENTION_COLOR}>{label}</Chip>
    </span>
  );
};
