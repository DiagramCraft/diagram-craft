import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Route adapter for the configurable Data Entity drawer. Data Stewardship-specific content is
 * supplied by the entity-drawer provider registry; governance cases remain in their specialized
 * case drawer.
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
    loadingMessage="Loading dataset…"
    unavailableMessage="This dataset is unavailable."
  />
);
