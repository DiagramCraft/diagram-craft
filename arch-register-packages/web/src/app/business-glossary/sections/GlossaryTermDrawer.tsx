import { useQuery } from '@tanstack/react-query';
import { glossaryTermQuery } from '../glossaryQueries';
import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { GlossaryQualityBadges } from './GlossaryQualityBadges';

export const GlossaryTermDrawer = ({
  workspaceSlug,
  termId,
  onClose
}: {
  workspaceSlug: string;
  termId: string;
  onClose: () => void;
}) => {
  const term = useQuery(glossaryTermQuery(workspaceSlug, termId));

  return (
    <EntityDrawer
      workspaceSlug={workspaceSlug}
      entityId={term.data?.entity._uid ?? ''}
      entityOverride={term.data?.entity}
      additionalBadges={
        term.data ? <GlossaryQualityBadges quality={term.data.quality} /> : undefined
      }
      entityQueryEnabled={false}
      entityLoading={term.isLoading}
      entityUnavailable={term.isError || !term.data}
      entityLabel="glossary term"
      onClose={onClose}
    />
  );
};
