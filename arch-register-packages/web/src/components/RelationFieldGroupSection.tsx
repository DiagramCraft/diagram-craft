import type { ReactNode } from 'react';

// Minimal label + description header for a relation field group, used where relation fields are
// edited (RelationEditDialog, RelationCreateDialog, TypedRelationFieldEditor). Relations have no
// admin-configurable layout like entities (EntityOverviewLayout's panel/block system), so this
// just surfaces the group's own name/description rather than a per-workspace-configured title.
export const RelationFieldGroupSection = ({
  name,
  description,
  children
}: {
  name: string;
  description?: string;
  children: ReactNode;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--base-fg)' }}>{name}</div>
    {description && (
      <div style={{ fontSize: 11, color: 'var(--cmp-fg-disabled)', marginTop: -4 }}>
        {description}
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>
);
