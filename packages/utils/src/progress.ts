export type Progress = {
  status: 'complete' | 'error' | 'pending';
  message?: string;
  completion?: number;
};

export type ProgressCallback = (
  status: Progress['status'],
  opts: Pick<Progress, 'message' | 'completion'>
) => void;
