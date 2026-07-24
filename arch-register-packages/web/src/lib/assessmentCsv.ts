export const exportAssessmentResponsesToCSV = async (
  workspace: string,
  assessmentId: string
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.assessmentResponses.exportCsv({
    params: { workspace, assessmentId }
  });
  return result.body;
};
