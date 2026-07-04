export const exportAssessmentResponsesToCSV = async (
  workspace: string,
  projectId: string,
  assessmentId: string
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.assessmentResponses.exportCsv({
    params: { workspace, id: projectId, assessmentId }
  });
  return result.body;
};
