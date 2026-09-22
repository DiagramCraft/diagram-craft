import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';

/**
 * Compatibility adapter for callers that still render a Contract drawer locally. Entity links
 * use the same workspace-wide nested drawer opener as the shared host.
 */
export const ContractDrawer = ({
  workspaceSlug,
  contractId,
  onClose
}: {
  workspaceSlug: string;
  contractId: string;
  onClose: () => void;
}) => {
  const { openEntityDrawer } = useEntityDrawer();

  return (
    <EntityDrawer
      workspaceSlug={workspaceSlug}
      entityId={contractId}
      onClose={onClose}
      onOpenEntity={openEntityDrawer}
      entityLabel="contract"
    />
  );
};
