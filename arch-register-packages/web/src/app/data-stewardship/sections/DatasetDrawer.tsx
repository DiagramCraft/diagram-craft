import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Route adapter for the configurable Data Entity drawer. Data Stewardship-specific content is
 * supplied by the entity-drawer provider registry; governance cases remain in their specialized
 * case drawer.
 *
 * Kept as a wrapper (rather than inlined, #3394) for its one extra prop: `onOpenGovernanceCase`.
 * Each call site wires a different navigation (or omits it entirely) depending on whether that
 * screen has a case view to hand off to, so it's genuine per-screen wiring, not boilerplate.
 * Documented per-app exception, not a candidate to generalize.
 */
export const DatasetDrawer = ({
  workspaceSlug,
  datasetId,
  onClose,
  onOpenCase
}: {
  workspaceSlug: string;
  datasetId: string;
  onClose: () => void;
  onOpenCase?: (caseId: string) => void;
}) => (
  <EntityDrawer
    workspaceSlug={workspaceSlug}
    entityId={datasetId}
    onClose={onClose}
    onOpenGovernanceCase={onOpenCase}
    entityLabel="dataset"
  />
);
