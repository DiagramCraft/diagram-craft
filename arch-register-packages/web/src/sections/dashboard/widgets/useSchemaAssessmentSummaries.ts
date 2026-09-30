import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityAssessmentRows } from '../../entities/entityDrawer/useEntityAssessmentRows';

/** Assessments (one summary each) targeting the entity schema with the given name. */
export const useSchemaAssessmentSummaries = (schemaName: string) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === schemaName);
  const { summaries, isLoading } = useEntityAssessmentRows(workspaceSlug, schema?.id ?? null);
  return { workspaceSlug, schemaFound: schema != null, summaries, isLoading };
};
